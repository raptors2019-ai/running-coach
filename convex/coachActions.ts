"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";
const BETAS = ["server-side-fallback-2026-07-01"];

function checkPasscode(passcode: string) {
  const expected = process.env.COACH_PASSCODE ?? "Oakville5k";
  if (passcode !== expected) throw new Error("Wrong passcode");
}

const SYSTEM_PROMPT = `You are the user's personal running coach inside their training app. One athlete, one goal: the Oakville 5K at Coronation Park on Sunday October 4, 2026, targeting sub-25:00 (5:00/km), stretch goal 24:30.

Background you know: In April they raced the Foxtrail 10.3K in 56:50 (5:31/km) off a 6-week plan, beating their sub-60 goal by 5 minutes. Their April fitness converts to a ~26:25 5K. The current 6-week plan: Tuesday speed work, Thursday zone 2, Saturday easy partner run with their girlfriend, Sunday zone 2 long run, lifting Mon (upper) / Wed (lower). Key checkpoints: Aug 27 2K benchmark time trial (under 9:50 → chase 24:30; 9:50-10:30 → sub-25; slower → build and retest) and Sep 15 race pace test (3km @ 5:00/km). Zone 2 means genuinely easy, 6:45-7:15/km. Their cardio always outpaces their legs; they respond fast to training.

Your style: knowledgeable but human. Direct, encouraging, data-driven. Reference actual numbers from their data. Keep responses short — a few sentences to a short paragraph for chat; briefings can run a bit longer. Plain text only, no markdown formatting, no bullet symbols.

Strava data quirk: the athlete often records one session as several Strava activities (warmup, hard effort, cooldown logged separately). The sync attaches the activity whose pace best fits the planned target to the planned workout, and labels the leftovers by role — rows titled 'Warmup — ...' or 'Cooldown — ...' are segments of that day's session, so read the planned row as the main effort and the labeled rows as its bookends. If a day still looks mismatched (a time trial wearing a jogging pace, segments labeled wrong), call rematch_date for that day, then re-check with get_workouts before drawing conclusions.

You can edit the plan with your tools when the athlete asks or when circumstances clearly require it (travel, illness, fatigue, missed sessions). Rules: never edit completed workouts (history is immutable — rematch_date is the one exception, since it rebuilds a day from Strava rather than rewriting it); protect the Tuesday quality sessions and the two checkpoint workouts — move them rather than drop them; easy volume is the first thing to cut; never stack hard days back to back; nothing hard in the final 3 days before the race. After making changes, summarize exactly what you changed. Dates are YYYY-MM-DD. If a request is ambiguous, make the sensible coaching call and say what you assumed.`;

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
];

type CoachContext = {
  today: string;
  plan: { name: string; raceDate: string; goalPace: string; startDate: string } | null;
  workouts: unknown[];
  journals: unknown[];
  recentMessages: { role: "user" | "assistant"; content: string }[];
  latestBriefing: { date: string; content: string } | null;
};

function contextBlock(context: CoachContext): string {
  const daysToRace = context.plan
    ? Math.ceil((new Date(context.plan.raceDate + "T00:00:00").getTime() - new Date(context.today + "T00:00:00").getTime()) / 86400000)
    : null;
  return [
    `CURRENT TRAINING DATA (today: ${context.today}${daysToRace !== null ? `, ${daysToRace} days to race` : ""})`,
    `Plan: ${JSON.stringify(context.plan)}`,
    `Workouts last 14 days + upcoming: ${JSON.stringify(context.workouts)}`,
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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Anthropic errors arrive as a JSON blob inside the message. Surface the part
 * that tells the user what to actually do about it.
 */
function friendlyApiError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) {
    return new Error("Anthropic rejected the API key. Check ANTHROPIC_API_KEY in the Convex deployment (npx convex env list).");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new Error("Anthropic rate limit hit — wait a moment and try again.");
  }
  if (e instanceof Anthropic.APIError) {
    const detail = typeof e.message === "string" ? e.message : String(e);
    if (/credit balance|billing|quota/i.test(detail)) {
      return new Error("Anthropic account has no API credits. Add credits at console.anthropic.com under Billing — a Claude.ai subscription does not cover API usage.");
    }
    return new Error(`Anthropic API error ${e.status}: ${detail}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Server-side refusal fallbacks are opt-in per account. If the beta isn't
 * enabled the request 400s on the parameter itself, so retry once without it
 * rather than failing the whole briefing.
 */
async function createMessage(
  client: Anthropic,
  params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "betas" | "fallbacks">
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await client.beta.messages.create({ ...params, betas: BETAS, fallbacks: "default" });
  } catch (e) {
    const isFallbackRejection =
      e instanceof Anthropic.APIError &&
      e.status === 400 &&
      /fallback|beta/i.test(String(e.message));
    if (!isFallbackRejection) throw friendlyApiError(e);
    try {
      return await client.beta.messages.create(params);
    } catch (retryError) {
      throw friendlyApiError(retryError);
    }
  }
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
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
      messages.push({ role: "user", content: results });
    }

    if (!reply) reply = "Sorry, I lost my train of thought — try asking again.";
    await ctx.runMutation(internal.coach.insertMessage, { role: "assistant", content: reply });
    return reply;
  },
});

export const generateBriefing = internalAction({
  handler: async (ctx) => {
    // Fresh data first — sync is best-effort, the briefing still runs without it
    try {
      await ctx.runAction(api.strava.syncAndAutoMatch, {});
    } catch {
      // Not connected or Strava down — brief on what we have
    }

    const context: CoachContext = await ctx.runQuery(internal.coach.getCoachContext);
    const client = new Anthropic();

    const response = await createMessage(client, {
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: contextBlock(context) },
      ],
      messages: [
        {
          role: "user",
          content:
            "Write this morning's briefing. Cover: how yesterday went (or the last workout if yesterday was rest), how the week is tracking against the plan, anything in the data worth flagging (pace drift, missed sessions, fatigue signals from journal mood), and what today's focus is. If recent chat mentioned schedule constraints, account for them. 4-8 sentences, plain text, written directly to the athlete.",
        },
      ],
    });

    if (response.stop_reason === "refusal") return;
    const content = textOf(response.content);
    if (content) {
      await ctx.runMutation(internal.coach.upsertBriefing, { date: context.today, content });
    }
  },
});

export const generateBriefingNow = action({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    await ctx.runAction(internal.coachActions.generateBriefing, {});
  },
});
