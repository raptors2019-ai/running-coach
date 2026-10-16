"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { isRunningType } from "./lib/stravaMapping";
import { checkPasscode } from "./lib/passcode";
import { MODEL, createMessage, textOf } from "./lib/anthropicClient";
import { slotInputToSlot, weekForPrompt } from "./lib/seasonPrompt";

function addDaysIso(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const SYSTEM_PROMPT = `You are the user's personal running coach inside their training app. One athlete.

Background you know: In April they raced the Foxtrail 10.3K in 56:50 (5:31/km) off a 6-week plan. Then a 6-week block for the Oakville 5K on October 4, 2026 (goal sub-25, stretch 24:30): Aug 27 2K benchmark 9:12, Sep 15 3K at 4:56/km, and on race day 23:38 chip, splits 4:57 / 4:51 / 4:53 / 4:44 with the last 956m at 4:14/km, HR 170 to 185. Their cardio always outpaces their legs; they respond fast to training. Zone 2 means genuinely easy, 6:45-7:15/km.

Off-season (when SEASON is in your context): no race booked, but two goals — 10K under 50:00 by about April and 5K under 20:00 by about June. The season is split into phases with checkpoint time trials on target weekends. The athlete runs 2-3 times a week on whatever days life allows, plus basketball, rides and lifting, so weeks are planned as SLOTS with no days: usually one quality session, one long run, and an optional easy run. Whichever runs happen that week fill the slots — the app computes the fills (filledBy) and they are ground truth; never ask which day they'll run. Quality first: if only two runs happen, it's the quality session and the long run; the easy run is a bonus. In Base the long run grows about 1 km a week from 10-12 km, easy runs stay easy, and cross-training counts as aerobic work, not something to apologise for. Plan with get_week_plan and set_week_slots (use add_workout only for the old dated plan, never in season mode). Keep slot ids stable when you edit a week (q1, long, easy) so pins survive. If the matcher put a run in the wrong slot, fix it with pin_run. When the athlete asks for a change in chat (skip, push, swap, a busy week), make it and summarise exactly what you changed.

Your style: knowledgeable but human. Direct, encouraging, data-driven. Reference actual numbers from their data. Keep responses short — a few sentences to a short paragraph for chat; briefings can run a bit longer. Plain text only, no markdown formatting, no bullet symbols.

Think week-first: judge progress against THIS WEEK SO FAR and the WEEKLY REVIEW HISTORY (the trend across weeks), not just yesterday in isolation. The week stats are computed by the app — quote them as ground truth. Rest days and lift-only days are part of the plan, not gaps: they need no run commentary. A missed or unlogged run gets at most one neutral sentence, never speculation about what might have happened and never repeated across briefings. If yesterday has nothing worth saying, skip it entirely and lead with the week and today's focus — a short briefing is a good briefing.

Strava data quirk: the athlete often records one session as several Strava activities (warmup, hard effort, cooldown logged separately). The sync attaches the activity whose pace best fits the planned target to the planned workout, and labels the leftovers by role — rows titled 'Warmup — ...' or 'Cooldown — ...' are segments of that day's session, so read the planned row as the main effort and the labeled rows as its bookends. If a day still looks mismatched (a time trial wearing a jogging pace, segments labeled wrong), call rematch_date for that day, then re-check with get_workouts before drawing conclusions.

You can edit the plan with your tools when the athlete asks or when circumstances clearly require it (travel, illness, fatigue, missed sessions). Rules: a completed day's numbers are history and never change (rematch_date is the one exception, since it rebuilds a day from Strava rather than rewriting it) — but you may relabel a completed day with what was actually done, by moving the workout they did onto it (move_workout swaps plans, the logged run stays put) or with update_workout. When the athlete says they did one workout instead of another, apply that relabel first, then decide what the rest of the week needs: the displaced session gets a new day if it matters (quality, checkpoints, the long run), or is dropped if it was easy volume; protect quality sessions and checkpoint workouts — move them rather than drop them; easy volume is the first thing to cut; never stack hard days back to back; nothing hard in the final 3 days before a race or time trial. After making changes, summarize exactly what you changed. Dates are YYYY-MM-DD. If a request is ambiguous, make the sensible coaching call and say what you assumed.

Missed runs: a workout flagged missed:true is one the app's morning check found unlogged after its day passed (with overnight grace for late uploads). When a run is newly missed, decide whether the week needs rebalancing and make the edits yourself: missed easy volume is usually absorbed, not crammed in later; the long run may shift within its own week; quality sessions and checkpoints get moved, never dropped. If no edit is needed, one neutral sentence at most. Whatever you do, state it plainly in the briefing.

Splits: Strava's sync gives you whole-activity numbers only, so an interval session arrives as one meaningless average pace. The athlete fills that gap by uploading a screenshot of their watch's split table, which the app transcribes and lists as SPLIT UPLOADS in your context (get_splits fetches any date range, including older ones). Treat those splits as ground truth for what happened inside a session: judge a quality session on its work reps and their recoveries — rep-by-rep pace, heart rate and fade across reps — never on the session average. The paces there are computed by the app from distance and time, so quote them as they stand. A split marked "PACE DISAGREES WITH SCREENSHOT" may be a misread digit: say so rather than drawing a conclusion from it. If a hard session has no splits uploaded and the numbers you do have don't settle a question, it's fair to ask for the screenshot once.

Checkpoints: CHECKPOINT RESULTS in your context are ground truth for the goal — a recorded pass settles the question, never ask for a retest it already answered. When a checkpoint workout completes and no result is recorded yet, evaluate its decision rule against the actual numbers and store it with record_checkpoint (benchmark_2k = the Aug 27 2K TT, race_pace_3k = the Sep 15 3K @ 5:00), including goal_seconds when the outcome changes the race target.

Breathwork: since Sep 24 the athlete has done 15 minutes of breathwork a day, laid out on the app's Breathwork page (the Today screen shows the day's routine). Morning rhythm walk (5 min): walking in 3:2 (in 3 steps, out 2) through the nose, then practising the switch to 2:1, the race gear, with a firm complete exhale, plus a BOLT breath-hold check. Pre-sleep downshift (8-10 min): 4-in/6-out nasal, ending with physiological sighs. Easy runs: nose only for the first 10 minutes as the zone 2 limiter, then 3:2; strides in 2:1. Hard sessions: a 2-minute primer of physiological sighs before the first rep, 2:1 with full exhales during reps, sighs to open each recovery. Race: 3:2 through km 1, 2:1 by km 2, and the 3km checkpoint question is whether 2:1 is still rhythmic. Swims are easy with bilateral breathing, and never breath-hold sets in water. Ask about it occasionally, not every message, and be honest that it helps rhythm, calm and sleep rather than fitness.`;

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
    description: "Modify the planned workout on a date. Only provided fields change. On a completed day this relabels what was done (type, title, description); logged numbers never change. When you change the paces or reps of an interval session, also send intervals so the rep table matches the description.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        type: { type: "string", description: "One of: easy, long, tempo, intervals, race_pace, rest, upper_body, lower_body, shakeout, swim" },
        title: { type: "string" },
        description: { type: "string" },
        target_distance: { type: "number", description: "km" },
        target_pace: { type: "string", description: "e.g. '6:45-7:15'" },
        intervals: {
          type: "array",
          description: "Replaces the rep table shown on the workout card. Send [] to clear it.",
          items: {
            type: "object",
            properties: {
              distance: { type: "string", description: "e.g. '400m'" },
              pace: { type: "string", description: "e.g. '4:40-4:45/km'" },
              rest: { type: "string", description: "e.g. '90s jog'" },
              reps: { type: "number" },
            },
            required: ["distance", "pace", "rest", "reps"],
          },
        },
      },
      required: ["date"],
    },
  },
  {
    name: "move_workout",
    description: "Move the planned workout from one date to another. If the target date already has a workout, the two days swap plans — each day keeps its own logged run, so swapping into a completed day relabels what was actually done there. Two completed days cannot be swapped.",
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
    name: "get_week_plan",
    description: "Season mode: get one week's slots, which run filled each (app-computed), extra runs and cross-training.",
    input_schema: {
      type: "object",
      properties: { week_start: { type: "string", description: "The week's Monday, YYYY-MM-DD" } },
      required: ["week_start"],
    },
  },
  {
    name: "set_week_slots",
    description: "Season mode: write a week's run slots, replacing the week's list. Slots have no day; runs fill them whenever they happen. Keep ids stable (q1, long, easy) when editing so the athlete's pins survive. Use status 'set' for the current or coming week and 'draft' for later ones.",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "The week's Monday, YYYY-MM-DD" },
        status: { type: "string", enum: ["draft", "set"] },
        note: { type: "string", description: "One line on what the week is for" },
        slots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["quality", "long", "easy"] },
              type: { type: "string", description: "Workout type for colours: intervals, tempo, race_pace, long, easy" },
              title: { type: "string" },
              description: { type: "string" },
              target_distance: { type: "number", description: "km" },
              target_pace: { type: "string" },
              intervals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    distance: { type: "string" },
                    pace: { type: "string" },
                    rest: { type: "string" },
                    reps: { type: "number" },
                  },
                  required: ["distance", "pace", "rest", "reps"],
                },
              },
              optional: { type: "boolean", description: "A bonus slot that doesn't count against the week" },
              skipped: { type: "boolean", description: "Dropped this week (keeps it visible, filled by nothing)" },
            },
            required: ["id", "kind", "type", "title", "description"],
          },
        },
      },
      required: ["week_start", "status", "slots"],
    },
  },
  {
    name: "pin_run",
    description: "Season mode: say which logged run filled a slot, overriding the app's automatic match (the run's numbers never change).",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "The week's Monday, YYYY-MM-DD" },
        slot_id: { type: "string" },
        date: { type: "string", description: "Date of the run, YYYY-MM-DD" },
      },
      required: ["week_start", "slot_id", "date"],
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
  season: unknown | null;
};

/** Days to the race plan's race, or null once it has passed (or there's no plan). */
function daysUntilRace(plan: { raceDate: string } | null, today: string): number | null {
  if (!plan) return null;
  const days = Math.ceil((new Date(plan.raceDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  return days >= 0 ? days : null;
}

function contextBlock(context: CoachContext): string {
  const daysToRace = daysUntilRace(context.plan, context.today);
  return [
    `CURRENT TRAINING DATA (today: ${context.today}${daysToRace !== null ? `, ${daysToRace} days to race` : ""})`,
    context.season
      ? `SEASON (off-season plan; slot fills are app-computed ground truth): ${JSON.stringify(context.season)}`
      : "No off-season plan active.",
    `${context.season ? "Previous race plan (history)" : "Plan"}: ${JSON.stringify(context.plan)}`,
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
        intervals: input.intervals,
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
    case "get_week_plan":
      return JSON.stringify(
        weekForPrompt(await ctx.runQuery(internal.seasons.getWeekPlanInternal, { weekStart: input.week_start }))
      );
    case "set_week_slots":
      return await ctx.runMutation(internal.seasons.setWeekSlots, {
        weekStart: input.week_start,
        status: input.status,
        note: input.note,
        slots: (input.slots ?? []).map(slotInputToSlot),
      });
    case "pin_run":
      return await ctx.runMutation(internal.seasons.pinRunByDate, {
        weekStart: input.week_start,
        slotId: input.slot_id,
        date: input.date,
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

/**
 * Answer one chat message. Scheduled by coach.sendMessage rather than called
 * from the browser: a browser-invoked action is tied to the WebSocket, and
 * iOS drops that socket the moment Safari goes to the background, which
 * surfaced as "Connection lost while action was in flight" even though the
 * coach had finished editing the plan. Here the outcome is written to the
 * message row either way, so the UI can show the reply, or a retry, whenever
 * the tab comes back.
 */
export const replyToMessage = internalAction({
  args: { messageId: v.id("coachMessages") },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.coach.getMessage, { messageId: args.messageId });
    if (!message || message.role !== "user" || message.replyStatus !== "pending") return;

    try {
      const reply = await answer(ctx);
      await ctx.runMutation(internal.coach.saveReply, { messageId: args.messageId, content: reply });
    } catch (e) {
      console.error("Coach reply failed", e);
      await ctx.runMutation(internal.coach.failReply, {
        messageId: args.messageId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

/** Run the chat tool loop over the stored history and return the coach's text. */
async function answer(ctx: ActionCtx): Promise<string> {
  const client = new Anthropic();
  const context: CoachContext = await ctx.runQuery(internal.coach.getCoachContext);

  // History from the DB already includes the message being answered.
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

  return reply || "Sorry, I lost my train of thought — try asking again.";
}

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
    // Season weeks have no dated runs to brief on, so Monday (a new week of
    // slots) is the other reason to write one.
    const isMonday = new Date(context.today + "T12:00:00").getDay() === 1;
    const seasonMonday = context.season !== null && isMonday;
    if (!args.force && !yesterdayHadRun && !todayHasPlannedRun && !seasonMonday && newlyMissed === 0) {
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
    const daysToRace = daysUntilRace(input.plan, input.today);
    const inSeason = input.season !== null;

    const client = new Anthropic();
    const messages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            `Write the weekly review. Today is ${input.today}${daysToRace !== null ? ` (${daysToRace} days to race)` : ""}.`,
            ...(inSeason
              ? [
                  `SEASON (off-season plan; slot fills are app-computed ground truth): ${JSON.stringify(input.season)}`,
                  `Before writing the review, plan with set_week_slots: set the coming week (${input.nextWeekStart}, status "set") from what was actually run in the reviewed week, and draft the week after (status "draft"). Keep slot ids stable. The lookahead must say what you set.`,
                ]
              : []),
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
    ];

    // In season mode the review also plans: it may call the slot tools first,
    // so loop until write_weekly_review arrives. Outside a season it's the one
    // forced call it always was.
    const seasonTools = TOOLS.filter((t) => ["get_week_plan", "set_week_slots", "pin_run"].includes(t.name));
    let response: Anthropic.Beta.BetaMessage | null = null;
    let toolUse: Anthropic.Beta.BetaToolUseBlock | undefined;
    for (let turn = 0; turn < (inSeason ? 5 : 1); turn++) {
      const isLastTurn = turn === (inSeason ? 4 : 0);
      response = await createMessage(client, {
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        tools: inSeason ? [...seasonTools, WEEKLY_REVIEW_TOOL] : [WEEKLY_REVIEW_TOOL],
        tool_choice:
          inSeason && !isLastTurn ? { type: "auto" } : { type: "tool", name: WEEKLY_REVIEW_TOOL.name },
        messages,
      });
      if (response.stop_reason === "refusal") return;

      toolUse = response.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === WEEKLY_REVIEW_TOOL.name
      );
      if (toolUse) break;
      const planning = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );
      if (planning.length === 0) {
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: "Now call write_weekly_review." });
        continue;
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: await runToolCalls(ctx, planning) });
    }
    if (!response) return;
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
