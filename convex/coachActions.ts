"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { isRunningType } from "./lib/stravaMapping";
import { checkPasscode } from "./lib/passcode";
import { MODEL, createMessage, textOf } from "./lib/anthropicClient";

function addDaysIso(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const SYSTEM_PROMPT = `You are the user's personal running coach inside their training app. One athlete, one goal: the Oakville 5K at Coronation Park on Sunday October 4, 2026, targeting sub-25:00 (5:00/km), stretch goal 24:30.

Background you know: In April they raced the Foxtrail 10.3K in 56:50 (5:31/km) off a 6-week plan, beating their sub-60 goal by 5 minutes. Their April fitness converts to a ~26:25 5K. The current 6-week plan: Tuesday speed work, Thursday zone 2, Saturday easy partner run with their girlfriend, Sunday zone 2 long run, lifting Mon (upper) / Wed (lower). Key checkpoints: Aug 27 2K benchmark time trial (under 9:50 → chase 24:30; 9:50-10:30 → sub-25; slower → build and retest) and Sep 15 race pace test (3km @ 5:00/km). Zone 2 means genuinely easy, 6:45-7:15/km. Their cardio always outpaces their legs; they respond fast to training.

Your style: knowledgeable but human. Direct, encouraging, data-driven. Reference actual numbers from their data. Keep responses short — a few sentences to a short paragraph for chat; briefings can run a bit longer. Plain text only, no markdown formatting, no bullet symbols.

Think week-first: judge progress against THIS WEEK SO FAR and the WEEKLY REVIEW HISTORY (the trend across weeks), not just yesterday in isolation. The week stats are computed by the app — quote them as ground truth. Rest days and lift-only days are part of the plan, not gaps: they need no run commentary. A missed or unlogged run gets at most one neutral sentence, never speculation about what might have happened and never repeated across briefings. If yesterday has nothing worth saying, skip it entirely and lead with the week and today's focus — a short briefing is a good briefing.

Strava data quirk: the athlete often records one session as several Strava activities (warmup, hard effort, cooldown logged separately). The sync attaches the activity whose pace best fits the planned target to the planned workout, and labels the leftovers by role — rows titled 'Warmup — ...' or 'Cooldown — ...' are segments of that day's session, so read the planned row as the main effort and the labeled rows as its bookends. If a day still looks mismatched (a time trial wearing a jogging pace, segments labeled wrong), call rematch_date for that day, then re-check with get_workouts before drawing conclusions.

You can edit the plan with your tools when the athlete asks or when circumstances clearly require it (travel, illness, fatigue, missed sessions). Rules: never edit completed workouts (history is immutable — rematch_date is the one exception, since it rebuilds a day from Strava rather than rewriting it); protect the Tuesday quality sessions and the two checkpoint workouts — move them rather than drop them; easy volume is the first thing to cut; never stack hard days back to back; nothing hard in the final 3 days before the race. After making changes, summarize exactly what you changed. Dates are YYYY-MM-DD. If a request is ambiguous, make the sensible coaching call and say what you assumed.

Missed runs: a workout flagged missed:true is one the app's morning check found unlogged after its day passed (with overnight grace for late uploads). When a run is newly missed, decide whether the week needs rebalancing and make the edits yourself: missed easy volume is usually absorbed, not crammed in later; the long run may shift within its own week; quality sessions and checkpoints get moved, never dropped. If no edit is needed, one neutral sentence at most. Whatever you do, state it plainly in the briefing.

Splits: Strava's sync gives you whole-activity numbers only, so an interval session arrives as one meaningless average pace. The athlete fills that gap by uploading a screenshot of their watch's split table, which the app transcribes and lists as SPLIT UPLOADS in your context (get_splits fetches any date range, including older ones). Treat those splits as ground truth for what happened inside a session: judge a quality session on its work reps and their recoveries — rep-by-rep pace, heart rate and fade across reps — never on the session average. The paces there are computed by the app from distance and time, so quote them as they stand. A split marked "PACE DISAGREES WITH SCREENSHOT" may be a misread digit: say so rather than drawing a conclusion from it. If a hard session has no splits uploaded and the numbers you do have don't settle a question, it's fair to ask for the screenshot once.

Checkpoints: CHECKPOINT RESULTS in your context are ground truth for the goal — a recorded pass settles the question, never ask for a retest it already answered. When a checkpoint workout completes and no result is recorded yet, evaluate its decision rule against the actual numbers and store it with record_checkpoint (benchmark_2k = the Aug 27 2K TT, race_pace_3k = the Sep 15 3K @ 5:00), including goal_seconds when the outcome changes the race target.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_workouts",
    description: "Get all workouts (planned and completed) in a date range, inclusive. Use to check the schedule before editing it.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "update_workout",
    description: "Modify the planned workout on a date. Only provided fields change. Cannot edit completed workouts.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        type: { type: "string", description: "One of: easy, long, tempo, intervals, race_pace, rest, upper_body, lower_body, shakeout, swim" },
        title: { type: "string" },
        description: { type: "string" },
        target_distance: { type: "number", description: "km" },
        target_pace: { type: "string", description: "e.g. '6:45-7:15'" },
      },
      required: ["date"],
    },
  },
  {
    name: "move_workout",
    description: "Move the planned workout from one date to another. If the target date already has a planned workout, the two days are swapped.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "YYYY-MM-DD" },
        to_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["from_date", "to_date"],
    },
  },
  {
    name: "set_rest_day",
    description: "Replace the planned workout on a date with a rest day.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "rematch_date",
    description: "Re-run Strava matching for one date. Use when an auto-match looks wrong — e.g. a separately-logged warmup claimed a quality workout while the hard effort sits in an unplanned row. Clears the day's sync state and immediately re-syncs from Strava, then verify with get_workouts.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "add_workout",
    description: "Add a new planned workout on a date that has none.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        type: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        target_distance: { type: "number", description: "km" },
        target_pace: { type: "string" },
      },
      required: ["date", "type", "title", "description"],
    },
  },
  {
    name: "get_splits",
    description: "Get uploaded per-split detail (rep-by-rep distance, time, pace, heart rate) for sessions in a date range, inclusive. Your context already carries the last 14 days — use this to look further back, e.g. to compare today's reps against the same session three weeks ago.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "record_checkpoint",
    description: "Record the outcome of a checkpoint workout (the plan's decision points). Upserts by key — call again with the same key to correct an entry.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", enum: ["benchmark_2k", "race_pace_3k"] },
        date: { type: "string", description: "YYYY-MM-DD the checkpoint was run" },
        result_seconds: { type: "number", description: "Elapsed time of the test effort in seconds" },
        result_distance_km: { type: "number", description: "Distance of the test effort in km" },
        decision: { type: "string", description: "The decision the result triggers, e.g. 'Passed — chase 24:30'" },
        goal_seconds: { type: "number", description: "Updated race goal in seconds, only if the result changes it" },
      },
      required: ["key", "date", "decision"],
    },
  },
];

type WorkoutRow = {
  date: string;
  type: string;
  completed: boolean;
  isUnplanned?: boolean;
  originalType?: string;
};

type CoachContext = {
  today: string;
  plan: { name: string; raceDate: string; goalPace: string; startDate: string } | null;
  workouts: (WorkoutRow & Record<string, unknown>)[];
  journals: unknown[];
  recentMessages: { role: "user" | "assistant"; content: string }[];
  latestBriefing: { date: string; content: string } | null;
  currentWeek: { weekStart: string; stats: unknown };
  weeklyReviews: { weekStart: string; stats: unknown; review: string }[];
  checkpoints: { key: string; date: string; decision: string }[];
  splitUploads: unknown[];
};

function contextBlock(context: CoachContext): string {
  const daysToRace = context.plan
    ? Math.ceil((new Date(context.plan.raceDate + "T00:00:00").getTime() - new Date(context.today + "T00:00:00").getTime()) / 86400000)
    : null;
  return [
    `CURRENT TRAINING DATA (today: ${context.today}${daysToRace !== null ? `, ${daysToRace} days to race` : ""})`,
    `Plan: ${JSON.stringify(context.plan)}`,
    `Workouts last 14 days + upcoming: ${JSON.stringify(context.workouts)}`,
    `THIS WEEK SO FAR (Mon-Sun, app-computed — treat as ground truth): ${JSON.stringify(context.currentWeek)}`,
    context.checkpoints.length > 0
      ? `CHECKPOINT RESULTS (recorded decisions — ground truth for the goal): ${JSON.stringify(context.checkpoints)}`
      : "No checkpoint results recorded yet.",
    context.weeklyReviews.length > 0
      ? `WEEKLY REVIEW HISTORY (newest first): ${JSON.stringify(context.weeklyReviews)}`
      : "No weekly reviews yet — this is the first week.",
    context.splitUploads.length > 0
      ? `SPLIT UPLOADS (per-split detail the athlete uploaded from their watch — paces computed by the app, ground truth for what happened inside these sessions): ${JSON.stringify(context.splitUploads)}`
      : "No split screenshots uploaded in this window.",
    `Recent journal entries: ${JSON.stringify(context.journals)}`,
    context.latestBriefing ? `Latest briefing (${context.latestBriefing.date}): ${context.latestBriefing.content}` : "No briefings yet.",
  ].join("\n");
}

async function runTool(
  ctx: ActionCtx,
  name: string,
  input: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- validated by Convex arg validators on each call
): Promise<string> {
  switch (name) {
    case "get_workouts":
      return JSON.stringify(
        await ctx.runQuery(internal.coach.getWorkoutsRange, {
          startDate: input.start_date,
          endDate: input.end_date,
        })
      );
    case "update_workout":
      return await ctx.runMutation(internal.coach.coachUpdateWorkout, {
        date: input.date,
        type: input.type,
        title: input.title,
        description: input.description,
        targetDistance: input.target_distance,
        targetPace: input.target_pace,
      });
    case "move_workout":
      return await ctx.runMutation(internal.coach.coachMoveWorkout, {
        fromDate: input.from_date,
        toDate: input.to_date,
      });
    case "set_rest_day":
      return await ctx.runMutation(internal.coach.coachSetRestDay, { date: input.date });
    case "rematch_date": {
      const summary = await ctx.runMutation(internal.coach.coachRematchDate, { date: input.date });
      await ctx.runAction(api.strava.syncAndAutoMatch, {});
      return `${summary}; re-sync complete`;
    }
    case "add_workout":
      return await ctx.runMutation(internal.coach.coachAddWorkout, {
        date: input.date,
        type: input.type,
        title: input.title,
        description: input.description,
        targetDistance: input.target_distance,
        targetPace: input.target_pace,
      });
    case "get_splits":
      return JSON.stringify(
        await ctx.runQuery(internal.splits.getSplitsInRange, {
          startDate: input.start_date,
          endDate: input.end_date,
        })
      );
    case "record_checkpoint":
      return await ctx.runMutation(internal.coach.coachRecordCheckpoint, {
        key: input.key,
        date: input.date,
        resultSeconds: input.result_seconds,
        resultDistanceKm: input.result_distance_km,
        decision: input.decision,
        goalSeconds: input.goal_seconds,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Execute every tool call in a response, collecting results (errors included) for the next turn. */
async function runToolCalls(
  ctx: ActionCtx,
  toolUses: Anthropic.Beta.BetaToolUseBlock[]
): Promise<Anthropic.Beta.BetaToolResultBlockParam[]> {
  const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
  for (const tu of toolUses) {
    try {
      const result = await runTool(ctx, tu.name, tu.input as Record<string, unknown>);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    } catch (e) {
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: e instanceof Error ? e.message : String(e),
        is_error: true,
      });
    }
  }
  return results;
}

export const sendMessage = action({
  args: { passcode: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    const client = new Anthropic();

    await ctx.runMutation(internal.coach.insertMessage, { role: "user", content: args.text });
    const context: CoachContext = await ctx.runQuery(internal.coach.getCoachContext);

    // History from the DB already includes the message just inserted.
    // Drop any leading assistant turns — the API requires user-first.
    const history = [...context.recentMessages];
    while (history.length && history[0].role === "assistant") history.shift();
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let reply = "";
    for (let turn = 0; turn < 8; turn++) {
      const response = await createMessage(client, {
        model: MODEL,
        max_tokens: 4096,
        system: [
          { type: "text", text: SYSTEM_PROMPT },
          { type: "text", text: contextBlock(context) },
        ],
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        reply = "I can't help with that one — let's keep it to training.";
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );

      if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
        reply = textOf(response.content);
        break;
      }

      // Execute all tool calls, return all results in one user message
      messages.push({ role: "user", content: await runToolCalls(ctx, toolUses) });
    }

    if (!reply) reply = "Sorry, I lost my train of thought — try asking again.";
    await ctx.runMutation(internal.coach.insertMessage, { role: "assistant", content: reply });
    return reply;
  },
});

export const generateBriefing = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Fresh data first — sync is best-effort, the briefing still runs without it
    try {
      await ctx.runAction(api.strava.syncAndAutoMatch, {});
    } catch {
      // Not connected or Strava down — brief on what we have
    }

    // After the sync (so late-evening uploads got their chance to complete a
    // day), flag planned runs whose date passed with nothing logged.
    const newlyMissed: number = await ctx.runMutation(internal.workouts.markMissedRuns, {});

    const context: CoachContext = await ctx.runQuery(internal.coach.getCoachContext);

    // Nothing happened, nothing coming: skip entirely. No run synced for
    // yesterday and no run planned today means there is no briefing to write —
    // rest days stay silent. The manual button passes force to override.
    const isRun = (w: WorkoutRow) =>
      isRunningType(w.type) || w.type === "run" || (w.originalType ? isRunningType(w.originalType) : false);
    const yesterday = (() => {
      const d = new Date(context.today + "T12:00:00");
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();
    const yesterdayHadRun = context.workouts.some(
      (w) => w.date === yesterday && w.completed && isRun(w)
    );
    const todayHasPlannedRun = context.workouts.some(
      (w) => w.date === context.today && !w.isUnplanned && isRun(w)
    );
    if (!args.force && !yesterdayHadRun && !todayHasPlannedRun && newlyMissed === 0) {
      console.log(`Briefing skipped for ${context.today}: no run yesterday, none planned today`);
      return;
    }

    const client = new Anthropic();

    // Same tool loop as chat: the briefing can adapt the plan (missed runs)
    // and record checkpoint outcomes, then must say what it did.
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: "user",
        content:
          "Write this morning's briefing. Lead with what matters most today. If yesterday had a run, react to its actual numbers; if yesterday was rest, a lift, or simply has no data, don't comment on it — go straight to the week. Use THIS WEEK SO FAR and the weekly review history for the holistic view (volume and pace trend across weeks, not just days), then set today's focus. If a workout is newly flagged missed:true, decide whether the week needs rebalancing, make any edits with your tools per your guardrails, and state exactly what you changed (or that nothing needed to change). If a checkpoint workout has completed but has no recorded result, evaluate its decision rule and record it with record_checkpoint, then state the outcome. If recent chat mentioned schedule constraints, account for them. 2-8 sentences depending on how much actually happened — short is fine. Plain text, written directly to the athlete.",
      },
    ];

    let content = "";
    for (let turn = 0; turn < 6; turn++) {
      const response = await createMessage(client, {
        model: MODEL,
        max_tokens: 2048,
        system: [
          { type: "text", text: SYSTEM_PROMPT },
          { type: "text", text: contextBlock(context) },
        ],
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") return;

      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );
      if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
        content = textOf(response.content);
        break;
      }
      messages.push({ role: "user", content: await runToolCalls(ctx, toolUses) });
    }

    if (content) {
      await ctx.runMutation(internal.coach.upsertBriefing, { date: context.today, content });
    }
  },
});

/**
 * The weekly review is stored as structured fields, so the model fills a tool
 * schema rather than free text. Forcing the tool call keeps the shape stable.
 */
const WEEKLY_REVIEW_TOOL: Anthropic.Beta.BetaTool = {
  name: "write_weekly_review",
  description: "Save the weekly review: a recap of the completed week and a look-ahead for the coming week.",
  input_schema: {
    type: "object",
    properties: {
      recap: {
        type: "string",
        description:
          "Review of the completed week, written to the athlete. Cover completion and volume vs plan, how the quality session actually went (real paces and HR), and the fitness trend versus previous weeks. Don't itemize every day. 3-6 sentences, plain text.",
      },
      lookahead: {
        type: "string",
        description:
          "The coming week in context: what it's for in the block, where it sits relative to the race and checkpoints, and the one session that matters most. 2-4 sentences, plain text.",
      },
      targets: {
        type: "array",
        items: { type: "string" },
        description:
          "2-4 concrete, checkable targets for the coming week, each one short line with real numbers (e.g. 'Tuesday 5x800m at 4:45-4:55/km with 2:30 jog'). Ordered by importance.",
      },
      reminders: {
        type: "array",
        items: { type: "string" },
        description:
          "1-4 things not to forget this week: guardrails (easy days genuinely easy at 6:45-7:15/km), scheduling (checkpoint date, race logistics, taper rules), recovery, or anything the athlete raised in chat or journal. Each one short line.",
      },
    },
    required: ["recap", "lookahead", "targets", "reminders"],
  },
};

type WeeklyReviewOutput = {
  recap: string;
  lookahead: string;
  targets: string[];
  reminders: string[];
};

export const generateWeeklyReview = internalAction({
  handler: async (ctx) => {
    try {
      await ctx.runAction(api.strava.syncAndAutoMatch, {});
    } catch {
      // Best effort — review what we have
    }

    const input = await ctx.runQuery(internal.coach.getWeekReviewInput);
    const daysToRace = input.plan
      ? Math.ceil(
          (new Date(input.plan.raceDate + "T00:00:00").getTime() -
            new Date(input.today + "T00:00:00").getTime()) /
            86400000
        )
      : null;

    const client = new Anthropic();
    const response = await createMessage(client, {
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      tools: [WEEKLY_REVIEW_TOOL],
      tool_choice: { type: "tool", name: WEEKLY_REVIEW_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            `Write the weekly review. Today is ${input.today}${daysToRace !== null ? ` (${daysToRace} days to race)` : ""}.`,
            `The completed week to review runs ${input.weekStart} to ${addDaysIso(input.weekStart, 6)} (Mon-Sun). The week to look ahead to starts ${input.nextWeekStart}.`,
            `Plan: ${JSON.stringify(input.plan)}`,
            `Completed week's app-computed stats (ground truth): ${JSON.stringify(input.stats)}`,
            `Completed week's workouts (planned and actual): ${JSON.stringify(input.workouts)}`,
            input.journals.length > 0
              ? `Journal entries from the completed week: ${JSON.stringify(input.journals)}`
              : "No journal entries from the completed week.",
            input.splitUploads.length > 0
              ? `Split detail uploaded from the watch for the completed week (ground truth for what happened inside these sessions — judge quality work on the reps, not the session average): ${JSON.stringify(input.splitUploads)}`
              : "No split screenshots uploaded for the completed week.",
            input.checkpoints.length > 0
              ? `Checkpoint results (ground truth for the goal): ${JSON.stringify(input.checkpoints)}`
              : "No checkpoint results recorded yet.",
            `Coming week's planned workouts: ${JSON.stringify(input.nextWeekWorkouts)}`,
            input.previousReviews.length > 0
              ? `Previous weekly reviews, newest first: ${JSON.stringify(input.previousReviews)}`
              : "This is the first weekly review of the block.",
            "Fill in write_weekly_review. The recap looks back only; the lookahead, targets and reminders look forward only. Quote the app-computed numbers, not your own arithmetic. If the completed week has no logged runs, say so in one neutral sentence and spend the recap on the trend instead.",
          ].join("\n"),
        },
      ],
    });

    if (response.stop_reason === "refusal") return;

    const toolUse = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock =>
        b.type === "tool_use" && b.name === WEEKLY_REVIEW_TOOL.name
    );
    const output = toolUse ? (toolUse.input as Partial<WeeklyReviewOutput>) : null;
    const asLines = (v: unknown): string[] | undefined =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : undefined;

    // If the tool call somehow didn't happen, keep whatever text came back as the recap.
    const review = (output?.recap ?? textOf(response.content)).trim();
    if (!review) return;

    await ctx.runMutation(internal.coach.upsertWeeklyReview, {
      weekStart: input.weekStart,
      stats: input.stats,
      review,
      lookahead: output?.lookahead?.trim() || undefined,
      targets: asLines(output?.targets),
      reminders: asLines(output?.reminders),
    });
  },
});

export const generateWeeklyReviewNow = action({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    await ctx.runAction(internal.coachActions.generateWeeklyReview, {});
  },
});

export const generateBriefingNow = action({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    await ctx.runAction(internal.coachActions.generateBriefing, { force: true });
  },
});
