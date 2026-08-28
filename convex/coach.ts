import { query, internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { inferWeekNumber, getDayOfWeek } from "./lib/stravaMapping";

function todayToronto(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

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

    return {
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
