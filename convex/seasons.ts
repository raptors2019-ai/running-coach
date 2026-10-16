import { query, mutation, internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { seasonFields } from "./lib/seasonFields";
import { slotValidator, type Slot } from "./lib/slots";
import { fillSlots, weekRuns } from "./lib/slotMatching";
import { isRunningType } from "./lib/stravaMapping";
import {
  addDaysIso,
  findActiveSeason,
  mondayOf,
  nextCheckpoint,
  phaseFor,
  seasonProgress,
  seasonWeekIndex,
  todayToronto,
} from "./lib/season";

export type WorkoutSummary = Pick<
  Doc<"workouts">,
  "_id" | "date" | "dayOfWeek" | "title" | "type" | "actualDistance" | "actualDuration" | "actualPace" | "avgHeartRate"
>;

const summarize = (w: Doc<"workouts">): WorkoutSummary => ({
  _id: w._id,
  date: w.date,
  dayOfWeek: w.dayOfWeek,
  title: w.title,
  type: w.type,
  actualDistance: w.actualDistance,
  actualDuration: w.actualDuration,
  actualPace: w.actualPace,
  avgHeartRate: w.avgHeartRate,
});

export async function activeSeason(ctx: QueryCtx, today = todayToronto()) {
  return findActiveSeason(await ctx.db.query("seasons").collect(), today);
}

async function weekPlanFor(ctx: QueryCtx, weekStart: string) {
  return await ctx.db
    .query("weekPlans")
    .withIndex("by_week_start", (q) => q.eq("weekStart", weekStart))
    .first();
}

/**
 * One season week, fully derived: the coach's slots, which run fills each
 * (computed now, never stored), the runs that filled nothing, and the
 * cross-training around them.
 */
export async function loadSeasonWeek(ctx: QueryCtx, weekStart: string) {
  const plan = await weekPlanFor(ctx, weekStart);
  const rows = await ctx.db
    .query("workouts")
    .withIndex("by_date", (q) => q.gte("date", weekStart).lte("date", addDaysIso(weekStart, 6)))
    .collect();
  const runs = weekRuns(rows.map((w) => ({ ...w, _id: w._id as string })));
  const slots: Slot[] = plan?.slots ?? [];
  const { fills, extras } = fillSlots(slots, runs);
  const crossTraining = rows.filter(
    (w) => w.completed && w.type !== "rest" && !isRunningType(w.type) && w.type !== "run"
  );
  const asSummary = (r: (typeof runs)[number]) => summarize(r as unknown as Doc<"workouts">);
  return {
    weekStart,
    plan,
    slots,
    fills: Object.fromEntries(Object.entries(fills).map(([id, r]) => [id, r ? asSummary(r) : null])) as Record<
      string,
      WorkoutSummary | null
    >,
    extras: extras.map(asSummary),
    // Synced rows carry a generic title ("Cross Training"); the Strava
    // activity name ("Night Basketball") is in the description.
    crossTraining: crossTraining.map((w) => ({
      type: w.type,
      title: w.title,
      name: w.description,
      actualDistance: w.actualDistance,
    })),
    totals: {
      runKm: Math.round(runs.reduce((km, r) => km + (r.actualDistance ?? 0), 0) * 10) / 10,
      runs: runs.length,
      crossCount: crossTraining.length,
    },
  };
}

export const getActiveSeason = query({
  handler: async (ctx) => {
    const today = todayToronto();
    const season = await activeSeason(ctx, today);
    if (!season) return null;
    return {
      season,
      today,
      weekStart: mondayOf(today),
      weekIndex: seasonWeekIndex(season, today),
      phase: phaseFor(season, today),
      progress: seasonProgress(season, today),
      nextCheckpoint: nextCheckpoint(season, today),
    };
  },
});

export const getSeasonWeek = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => loadSeasonWeek(ctx, args.weekStart),
});

/**
 * The athlete's own correction when the matcher guessed wrong: this run was
 * that slot. Changes which run fills a slot, never a run's numbers. Null
 * clears the pin and hands the slot back to auto-matching.
 */
export const pinRunToSlot = mutation({
  args: { weekStart: v.string(), slotId: v.string(), workoutId: v.union(v.id("workouts"), v.null()) },
  handler: async (ctx, args) => applyPin(ctx, args.weekStart, args.slotId, args.workoutId),
});

async function applyPin(ctx: MutationCtx, weekStart: string, slotId: string, workoutId: Id<"workouts"> | null) {
  const plan = await weekPlanFor(ctx, weekStart);
  if (!plan) throw new Error(`No week plan for ${weekStart}`);
  if (!plan.slots.some((s) => s.id === slotId)) throw new Error(`No slot ${slotId} that week`);
  if (workoutId) {
    const w = await ctx.db.get(workoutId);
    if (!w || w.date < weekStart || w.date > addDaysIso(weekStart, 6)) {
      throw new Error("That run isn't in this week");
    }
  }
  const pinned = workoutId ?? undefined;
  await ctx.db.patch(plan._id, {
    slots: plan.slots.map((s) =>
      s.id === slotId
        ? { ...s, pinnedWorkoutId: pinned }
        : // One run fills one slot: moving a pin releases it elsewhere.
          s.pinnedWorkoutId && s.pinnedWorkoutId === pinned
          ? { ...s, pinnedWorkoutId: undefined }
          : s
    ),
  });
}

/** The coach's pin: the run on a date (its longest, if there were several) fills a slot. */
export const pinRunByDate = internalMutation({
  args: { weekStart: v.string(), slotId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const run = weekRuns(rows.map((w) => ({ ...w, _id: w._id as string }))).sort(
      (a, b) => (b.actualDistance ?? 0) - (a.actualDistance ?? 0)
    )[0];
    if (!run) throw new Error(`No logged run on ${args.date}`);
    await applyPin(ctx, args.weekStart, args.slotId, run._id as Id<"workouts">);
    return `Pinned the ${run.actualDistance} km run on ${args.date} to slot ${args.slotId}`;
  },
});

/** Seeds a season. Run from the CLI: `npx convex run seasons:createSeason '{…}'`. */
export const createSeason = internalMutation({
  args: seasonFields,
  handler: async (ctx, args) => {
    const overlapping = (await ctx.db.query("seasons").collect()).find(
      (s) => s.startDate <= args.endDate && args.startDate <= s.endDate
    );
    if (overlapping) throw new Error(`Overlaps season "${overlapping.name}"`);
    return await ctx.db.insert("seasons", args);
  },
});

export const getWeekPlanInternal = internalQuery({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => loadSeasonWeek(ctx, args.weekStart),
});

/**
 * Write a week's slots (the coach's tool, also used for seeding). A slot
 * that keeps its id keeps its pin unless the new slot sets one, so the
 * coach rewording a session doesn't undo the athlete's correction.
 */
export const setWeekSlots = internalMutation({
  args: {
    weekStart: v.string(),
    slots: v.array(slotValidator),
    status: v.union(v.literal("draft"), v.literal("set")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (mondayOf(args.weekStart) !== args.weekStart) throw new Error(`${args.weekStart} is not a Monday`);
    const season = findActiveSeason(await ctx.db.query("seasons").collect(), args.weekStart);
    if (!season) throw new Error(`No season covers ${args.weekStart}`);
    const ids = new Set<string>();
    for (const s of args.slots) {
      if (ids.has(s.id)) throw new Error(`Duplicate slot id ${s.id}`);
      ids.add(s.id);
    }
    const existing = await weekPlanFor(ctx, args.weekStart);
    const oldPins = new Map((existing?.slots ?? []).map((s) => [s.id, s.pinnedWorkoutId]));
    const slots = args.slots.map((s) => ({ ...s, pinnedWorkoutId: s.pinnedWorkoutId ?? oldPins.get(s.id) }));
    const row = { seasonId: season._id, weekStart: args.weekStart, status: args.status, slots, note: args.note };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("weekPlans", row);
    return `Set ${slots.length} slots for the week of ${args.weekStart} (${args.status})`;
  },
});
