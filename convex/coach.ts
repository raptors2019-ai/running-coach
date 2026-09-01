import { query, internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { inferWeekNumber, getDayOfWeek, isRunningType } from "./lib/stravaMapping";

function todayToronto(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Monday of the week containing the given date (training weeks run Mon-Sun). */
function mondayOf(date: string): string {
  const d = new Date(date + "T12:00:00");
  const dow = d.getDay(); // 0 = Sunday
  return addDays(date, -(dow === 0 ? 6 : dow - 1));
}

type WeekStats = {
  runsPlanned: number;
  runsCompleted: number;
  plannedKm: number;
  actualKm: number;
  qualityTitle?: string;
  qualityCompleted: boolean;
  qualityPace?: string;
  longestRunKm: number;
};

const QUALITY_TYPES = new Set(["tempo", "intervals", "race_pace", "race"]);
const isRunRow = (t: string) => isRunningType(t) || t === "run";
const isSegmentRow = (title: string) => title.startsWith("Warmup —") || title.startsWith("Cooldown —");

/**
 * Deterministic week metrics (Mon-Sun window) — computed in code so the
 * numbers the coach quotes and the UI shows can never be hallucinated.
 * Warmup/cooldown segment rows count toward km but not toward run count.
 */
async function computeWeekStats(ctx: QueryCtx | MutationCtx, weekStart: string): Promise<WeekStats> {
  const weekEnd = addDays(weekStart, 6);
  const all = await ctx.db.query("workouts").collect();
  const week = all.filter((w) => w.date >= weekStart && w.date <= weekEnd);

  const stats: WeekStats = {
    runsPlanned: 0,
    runsCompleted: 0,
    plannedKm: 0,
    actualKm: 0,
    qualityCompleted: false,
    longestRunKm: 0,
  };

  for (const w of week) {
    if (!isRunRow(w.type) && !(w.originalType && isRunRow(w.originalType))) continue;
    if (!w.isUnplanned) {
      stats.runsPlanned++;
      stats.plannedKm += w.targetDistance ?? 0;
      if (QUALITY_TYPES.has(w.type) || (w.originalType && QUALITY_TYPES.has(w.originalType))) {
        stats.qualityTitle = w.title;
        stats.qualityCompleted = w.completed;
        if (w.actualPace) stats.qualityPace = w.actualPace;
      }
    }
    if (w.completed && w.actualDistance) {
      stats.actualKm += w.actualDistance;
      stats.longestRunKm = Math.max(stats.longestRunKm, w.actualDistance);
      if (!w.isUnplanned || !isSegmentRow(w.title)) stats.runsCompleted++;
    }
  }
  stats.plannedKm = Math.round(stats.plannedKm * 10) / 10;
  stats.actualKm = Math.round(stats.actualKm * 10) / 10;
  return stats;
}

const WEEK_STATS_VALIDATOR = v.object({
  runsPlanned: v.number(),
  runsCompleted: v.number(),
  plannedKm: v.number(),
  actualKm: v.number(),
  qualityTitle: v.optional(v.string()),
  qualityCompleted: v.boolean(),
  qualityPace: v.optional(v.string()),
  longestRunKm: v.number(),
});

export const getCurrentWeekStats = query({
  handler: async (ctx) => {
    const weekStart = mondayOf(todayToronto());
    return { weekStart, stats: await computeWeekStats(ctx, weekStart) };
  },
});

export const getWeeklyReviews = query({
  handler: async (ctx) => {
    const reviews = await ctx.db.query("coachWeeklyReviews").collect();
    return reviews.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 12);
  },
});

export const getWeekReviewInput = internalQuery({
  handler: async (ctx) => {
    const today = todayToronto();
    const weekStart = mondayOf(today);
    const stats = await computeWeekStats(ctx, weekStart);
    const reviews = await ctx.db.query("coachWeeklyReviews").collect();
    const previousReviews = reviews
      .filter((r) => r.weekStart < weekStart)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 6)
      .map((r) => ({ weekStart: r.weekStart, stats: r.stats, review: r.review }));
    return { today, weekStart, stats, previousReviews };
  },
});

export const upsertWeeklyReview = internalMutation({
  args: { weekStart: v.string(), stats: WEEK_STATS_VALIDATOR, review: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coachWeeklyReviews")
      .withIndex("by_week_start", (q) => q.eq("weekStart", args.weekStart))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { stats: args.stats, review: args.review });
    } else {
      await ctx.db.insert("coachWeeklyReviews", args);
    }
  },
});

export const getBriefings = query({
  handler: async (ctx) => {
    const briefings = await ctx.db.query("coachBriefings").collect();
    return briefings.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  },
});

export const getMessages = query({
  handler: async (ctx) => {
    const messages = await ctx.db.query("coachMessages").order("asc").collect();
    return messages.slice(-50);
  },
});

export const insertMessage = internalMutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("coachMessages", args);
  },
});

export const upsertBriefing = internalMutation({
  args: { date: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coachBriefings")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content });
    } else {
      await ctx.db.insert("coachBriefings", args);
    }
  },
});

/**
 * Everything the coach needs to reason about training state: the plan,
 * a window of recent + upcoming workouts, journal mood, recent chat,
 * and the last briefing. Kept compact — it's serialized into the prompt.
 */
export const getCoachContext = internalQuery({
  handler: async (ctx) => {
    const today = todayToronto();
    const plan = await ctx.db.query("trainingPlan").first();

    const all = await ctx.db.query("workouts").collect();
    const windowStart = new Date(today + "T12:00:00");
    windowStart.setDate(windowStart.getDate() - 14);
    const startStr = windowStart.toISOString().split("T")[0];
    const recentAndUpcoming = all
      .filter((w) => w.date >= startStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => ({
        date: w.date,
        type: w.type,
        title: w.title,
        description: w.description,
        targetDistance: w.targetDistance,
        targetPace: w.targetPace,
        completed: w.completed,
        actualDistance: w.actualDistance,
        actualDuration: w.actualDuration,
        actualPace: w.actualPace,
        avgHeartRate: w.avgHeartRate,
        isUnplanned: w.isUnplanned,
        notes: w.notes,
      }));

    const journals = await ctx.db.query("journalEntries").collect();
    const recentJournals = journals
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map((j) => ({ date: j.date, mood: j.mood, notes: j.userNotes }));

    const messages = await ctx.db.query("coachMessages").order("asc").collect();
    const briefings = await ctx.db.query("coachBriefings").collect();
    const latestBriefing = briefings.sort((a, b) => b.date.localeCompare(a.date))[0];

    const weekStart = mondayOf(today);
    const currentWeek = { weekStart, stats: await computeWeekStats(ctx, weekStart) };
    const allReviews = await ctx.db.query("coachWeeklyReviews").collect();
    const weeklyReviews = allReviews
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 6)
      .map((r) => ({ weekStart: r.weekStart, stats: r.stats, review: r.review.slice(0, 500) }));

    return {
      currentWeek,
      weeklyReviews,
      today,
      plan: plan
        ? { name: plan.name, raceDate: plan.raceDate, goalPace: plan.goalPace, startDate: plan.startDate }
        : null,
      workouts: recentAndUpcoming,
      journals: recentJournals,
      recentMessages: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      latestBriefing: latestBriefing
        ? { date: latestBriefing.date, content: latestBriefing.content }
        : null,
    };
  },
});

// ---------- Tools the coach can call to edit the plan ----------

export const getWorkoutsRange = internalQuery({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("workouts").collect();
    return all
      .filter((w) => w.date >= args.startDate && w.date <= args.endDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => ({
        date: w.date,
        type: w.type,
        title: w.title,
        description: w.description,
        targetDistance: w.targetDistance,
        targetPace: w.targetPace,
        completed: w.completed,
        isUnplanned: w.isUnplanned,
      }));
  },
});

async function plannedWorkoutOn(ctx: QueryCtx | MutationCtx, date: string) {
  const onDate = await ctx.db
    .query("workouts")
    .withIndex("by_date", (q) => q.eq("date", date))
    .collect();
  return onDate.find((w) => !w.isUnplanned) ?? null;
}

export const coachUpdateWorkout = internalMutation({
  args: {
    date: v.string(),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    targetDistance: v.optional(v.number()),
    targetPace: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workout = await plannedWorkoutOn(ctx, args.date);
    if (!workout) throw new Error(`No planned workout on ${args.date}`);
    if (workout.completed) throw new Error(`Workout on ${args.date} is already completed — history is not editable`);
    const { date: _date, ...fields } = args;
    const patch = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(workout._id, patch);
    return `Updated ${args.date}: ${workout.title}`;
  },
});

export const coachMoveWorkout = internalMutation({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args) => {
    const from = await plannedWorkoutOn(ctx, args.fromDate);
    if (!from) throw new Error(`No planned workout on ${args.fromDate}`);
    if (from.completed) throw new Error(`Workout on ${args.fromDate} is already completed`);
    const to = await plannedWorkoutOn(ctx, args.toDate);
    if (to?.completed) throw new Error(`Workout on ${args.toDate} is already completed`);

    const plan = await ctx.db.query("trainingPlan").first();
    const week = (d: string) => (plan ? inferWeekNumber(d, plan.startDate) : 1);

    if (to) {
      // Swap the two days
      await ctx.db.patch(from._id, { date: args.toDate, dayOfWeek: getDayOfWeek(args.toDate), weekNumber: week(args.toDate) });
      await ctx.db.patch(to._id, { date: args.fromDate, dayOfWeek: getDayOfWeek(args.fromDate), weekNumber: week(args.fromDate) });
      return `Swapped ${args.fromDate} (${from.title}) with ${args.toDate} (${to.title})`;
    }
    await ctx.db.patch(from._id, { date: args.toDate, dayOfWeek: getDayOfWeek(args.toDate), weekNumber: week(args.toDate) });
    return `Moved ${from.title} from ${args.fromDate} to ${args.toDate}`;
  },
});

export const coachSetRestDay = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const workout = await plannedWorkoutOn(ctx, args.date);
    if (!workout) throw new Error(`No planned workout on ${args.date}`);
    if (workout.completed) throw new Error(`Workout on ${args.date} is already completed`);
    await ctx.db.patch(workout._id, {
      type: "rest",
      title: "Rest Day",
      description: "Rest day (adjusted by coach).",
      targetDistance: undefined,
      targetPace: undefined,
      intervals: undefined,
    });
    return `${args.date} is now a rest day (was: ${workout.title})`;
  },
});

export const coachAddWorkout = internalMutation({
  args: {
    date: v.string(),
    type: v.string(),
    title: v.string(),
    description: v.string(),
    targetDistance: v.optional(v.number()),
    targetPace: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.query("trainingPlan").first();
    if (!plan) throw new Error("No training plan found");
    const existing = await plannedWorkoutOn(ctx, args.date);
    if (existing) throw new Error(`${args.date} already has a planned workout (${existing.title}) — update or move it instead`);
    await ctx.db.insert("workouts", {
      ...args,
      planId: plan._id,
      weekNumber: inferWeekNumber(args.date, plan.startDate),
      dayOfWeek: getDayOfWeek(args.date),
      completed: false,
    });
    return `Added ${args.title} on ${args.date}`;
  },
});

/**
 * Reset one day's Strava sync state so the next sync can rematch it: planned
 * workouts revert to un-completed (restoring a sync-overwritten type), and
 * unplanned activity rows are removed. The activities' Strava IDs disappear
 * from the synced set, so an immediate re-sync re-imports and rematches them.
 */
export const coachRematchDate = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const onDate = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    if (onDate.length === 0) throw new Error(`No workouts on ${args.date}`);
    let cleared = 0;
    let removed = 0;
    for (const w of onDate) {
      if (w.isUnplanned) {
        await ctx.db.delete(w._id);
        removed++;
      } else if (w.completed || w.stravaActivityId) {
        await ctx.db.patch(w._id, {
          completed: false,
          actualDistance: undefined,
          actualDuration: undefined,
          actualPace: undefined,
          avgHeartRate: undefined,
          stravaActivityId: undefined,
          notes: undefined,
          ...(w.originalType ? { type: w.originalType, originalType: undefined } : {}),
        });
        cleared++;
      }
    }
    return `Reset ${cleared} planned workout(s), removed ${removed} unplanned activity row(s) on ${args.date}`;
  },
});
