import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { isRunningType, formatPaceWithUnit } from "./lib/stravaMapping";

export const getTrainingPlan = query({
  handler: async (ctx) => {
    return await ctx.db.query("trainingPlan").first();
  },
});

export const getWorkoutByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
  },
});

export const getTodayWorkout = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    return await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
  },
});

export const getAllWorkouts = query({
  handler: async (ctx) => {
    return await ctx.db.query("workouts").collect();
  },
});

export const getWorkoutsByWeek = query({
  args: { weekNumber: v.number() },
  handler: async (ctx, args) => {
    const plan = await ctx.db.query("trainingPlan").first();
    if (!plan) return [];
    return await ctx.db
      .query("workouts")
      .withIndex("by_week", (q) =>
        q.eq("planId", plan._id).eq("weekNumber", args.weekNumber)
      )
      .collect();
  },
});

export const getCompletedWorkouts = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("workouts").collect();
    return all.filter((w) => w.completed);
  },
});

export const markWorkoutComplete = mutation({
  args: {
    workoutId: v.id("workouts"),
    actualDistance: v.optional(v.number()),
    actualDuration: v.optional(v.number()),
    actualPace: v.optional(v.string()),
    avgHeartRate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { workoutId, ...data } = args;
    await ctx.db.patch(workoutId, {
      completed: true,
      ...data,
    });
  },
});

export const updateWorkoutFromStrava = mutation({
  args: {
    workoutId: v.id("workouts"),
    actualDistance: v.number(),
    actualDuration: v.number(),
    actualPace: v.string(),
    avgHeartRate: v.optional(v.number()),
    stravaActivityId: v.string(),
  },
  handler: async (ctx, args) => {
    const { workoutId, ...data } = args;
    await ctx.db.patch(workoutId, {
      completed: true,
      ...data,
    });
  },
});

export const swapWorkoutDates = mutation({
  args: {
    workoutId1: v.id("workouts"),
    workoutId2: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const w1 = await ctx.db.get(args.workoutId1);
    const w2 = await ctx.db.get(args.workoutId2);
    if (!w1 || !w2) throw new Error("Workout not found");
    if (w1.weekNumber !== w2.weekNumber) throw new Error("Can only swap within the same week");

    await ctx.db.patch(args.workoutId1, {
      date: w2.date,
      dayOfWeek: w2.dayOfWeek,
    });
    await ctx.db.patch(args.workoutId2, {
      date: w1.date,
      dayOfWeek: w1.dayOfWeek,
    });
  },
});

export const updateWorkoutType = mutation({
  args: {
    workoutId: v.id("workouts"),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workout = await ctx.db.get(args.workoutId);
    if (!workout) throw new Error("Workout not found");

    const patch: Record<string, unknown> = {};

    if (args.type !== undefined && args.type !== workout.type) {
      if (!workout.originalType) {
        patch.originalType = workout.type;
      }
      patch.type = args.type;
    }
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.workoutId, patch);
    }
  },
});

export const unmarkWorkoutComplete = mutation({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workoutId, {
      completed: false,
      actualDistance: undefined,
      actualDuration: undefined,
      actualPace: undefined,
      avgHeartRate: undefined,
      notes: undefined,
      stravaActivityId: undefined,
    });
  },
});

export const autoCompleteFromActivities = internalMutation({
  args: {
    activities: v.array(v.object({
      date: v.string(),
      stravaActivityId: v.string(),
      actualDistance: v.number(),
      actualDuration: v.number(),
      avgHeartRate: v.optional(v.number()),
      mappedType: v.string(),
      mappedTitle: v.string(),
      activityName: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{ autoCompleted: number; alreadyDone: number }> => {
    let autoCompleted = 0;
    let alreadyDone = 0;

    for (const activity of args.activities) {
      const workout = await ctx.db
        .query("workouts")
        .withIndex("by_date", (q) => q.eq("date", activity.date))
        .first();

      if (!workout) continue;
      if (workout.completed || workout.stravaActivityId) {
        alreadyDone++;
        continue;
      }

      const pace = activity.actualDistance > 0
        ? formatPaceWithUnit(activity.actualDistance, activity.actualDuration)
        : undefined;

      const plannedIsRun = isRunningType(workout.type);
      const activityIsRun = activity.mappedType === "run";

      const patch: Record<string, unknown> = {
        completed: true,
        actualDistance: activity.actualDistance,
        actualDuration: activity.actualDuration,
        actualPace: pace,
        avgHeartRate: activity.avgHeartRate,
        stravaActivityId: activity.stravaActivityId,
      };

      if (plannedIsRun && !activityIsRun) {
        patch.originalType = workout.type;
        patch.type = activity.mappedType;
        patch.title = activity.mappedTitle;
        patch.notes = `Originally planned: ${workout.title}. Did: ${activity.activityName}`;
      } else if (!plannedIsRun && activityIsRun) {
        patch.originalType = workout.type;
        patch.type = "easy";
        patch.title = "Easy Run";
        patch.notes = `Originally planned: ${workout.title}. Did: ${activity.activityName}`;
      }

      await ctx.db.patch(workout._id, patch);
      autoCompleted++;
    }

    return { autoCompleted, alreadyDone };
  },
});
