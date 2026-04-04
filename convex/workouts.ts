import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { isRunningType, formatPaceWithUnit, typeAffinityScore, inferWeekNumber, getDayOfWeek } from "./lib/stravaMapping";

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
  args: { today: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Prefer client-provided local date; fall back to server-side Toronto time
    const today = args.today ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
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

export const getWorkoutsByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const getUpcomingWorkouts = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("workouts").collect();
    return all.filter((w) => w.date >= args.startDate && w.date <= args.endDate);
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
  handler: async (ctx, args): Promise<{ autoCompleted: number; alreadyDone: number; newActivitiesCreated: number }> => {
    let autoCompleted = 0;
    let alreadyDone = 0;
    let newActivitiesCreated = 0;

    const plan = await ctx.db.query("trainingPlan").first();

    // Build set of already-synced activity IDs
    const allWorkouts = await ctx.db.query("workouts").collect();
    const syncedIds = new Set(
      allWorkouts.filter((w) => w.stravaActivityId).map((w) => w.stravaActivityId!)
    );

    // Filter out already-synced activities
    const newActivities = args.activities.filter((a) => !syncedIds.has(a.stravaActivityId));

    // Group activities by date
    const byDate = new Map<string, typeof newActivities>();
    for (const activity of newActivities) {
      const group = byDate.get(activity.date) || [];
      group.push(activity);
      byDate.set(activity.date, group);
    }

    for (const [date, dateActivities] of byDate) {
      const workoutsForDate = await ctx.db
        .query("workouts")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();

      // Find the uncompleted planned workout (not unplanned, not completed)
      const plannedWorkout = workoutsForDate.find(
        (w) => !w.isUnplanned && !w.completed && !w.stravaActivityId
      );

      // Check which activities already matched existing workouts
      const existingSyncedIds = new Set(
        workoutsForDate.filter((w) => w.stravaActivityId).map((w) => w.stravaActivityId!)
      );
      const unmatched = dateActivities.filter((a) => !existingSyncedIds.has(a.stravaActivityId));

      if (unmatched.length === 0) {
        alreadyDone += dateActivities.length;
        continue;
      }

      let bestMatchIdx = -1;

      if (plannedWorkout) {
        // Score each activity against the planned workout type
        let bestScore = -1;
        for (let i = 0; i < unmatched.length; i++) {
          const score = typeAffinityScore(plannedWorkout.type, unmatched[i].mappedType);
          if (score > bestScore) {
            bestScore = score;
            bestMatchIdx = i;
          }
        }

        // Patch the planned workout with the best match
        const bestActivity = unmatched[bestMatchIdx];
        const pace = bestActivity.actualDistance > 0
          ? formatPaceWithUnit(bestActivity.actualDistance, bestActivity.actualDuration)
          : undefined;

        const plannedIsRun = isRunningType(plannedWorkout.type);
        const activityIsRun = bestActivity.mappedType === "run" || isRunningType(bestActivity.mappedType);

        const patch: Record<string, unknown> = {
          completed: true,
          actualDistance: bestActivity.actualDistance,
          actualDuration: bestActivity.actualDuration,
          actualPace: pace,
          avgHeartRate: bestActivity.avgHeartRate,
          stravaActivityId: bestActivity.stravaActivityId,
        };

        if (plannedIsRun && !activityIsRun) {
          patch.originalType = plannedWorkout.type;
          patch.type = bestActivity.mappedType;
          patch.title = bestActivity.mappedTitle;
          patch.notes = `Originally planned: ${plannedWorkout.title}. Did: ${bestActivity.activityName}`;
        } else if (!plannedIsRun && activityIsRun) {
          patch.originalType = plannedWorkout.type;
          patch.type = "easy";
          patch.title = "Easy Run";
          patch.notes = `Originally planned: ${plannedWorkout.title}. Did: ${bestActivity.activityName}`;
        }

        await ctx.db.patch(plannedWorkout._id, patch);
        autoCompleted++;
      }

      // Create new workout records for remaining activities
      for (let i = 0; i < unmatched.length; i++) {
        if (i === bestMatchIdx) continue;
        const activity = unmatched[i];
        const pace = activity.actualDistance > 0
          ? formatPaceWithUnit(activity.actualDistance, activity.actualDuration)
          : undefined;

        await ctx.db.insert("workouts", {
          planId: plan?._id ?? workoutsForDate[0]?.planId ?? ("" as never),
          date: activity.date,
          weekNumber: plan ? inferWeekNumber(activity.date, plan.startDate) : 1,
          dayOfWeek: getDayOfWeek(activity.date),
          type: activity.mappedType,
          title: activity.mappedTitle,
          description: activity.activityName,
          completed: true,
          actualDistance: activity.actualDistance,
          actualDuration: activity.actualDuration,
          actualPace: pace,
          avgHeartRate: activity.avgHeartRate,
          stravaActivityId: activity.stravaActivityId,
          isUnplanned: true,
        });
        newActivitiesCreated++;
      }
    }

    return { autoCompleted, alreadyDone, newActivitiesCreated };
  },
});
