import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addBaselineRuns = mutation({
  handler: async (ctx) => {
    const plan = await ctx.db.query("trainingPlan").first();
    if (!plan) throw new Error("No training plan found");

    // Add Mar 4 10K baseline (day before plan starts)
    const existing = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", "2026-03-04"))
      .first();

    if (!existing) {
      await ctx.db.insert("workouts", {
        planId: plan._id,
        date: "2026-03-04",
        weekNumber: 1,
        dayOfWeek: "Wed",
        type: "long",
        title: "10K Baseline Run",
        description: "Pre-plan baseline 10K. Great data point for tracking progress.",
        targetDistance: 10,
        targetPace: undefined,
        completed: true,
        actualDistance: 10.01,
        actualDuration: 4423,
        actualPace: "7:22",
        stravaActivityId: "17618122233",
      });
    }

    // Add Feb 27 run
    const existingFeb = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", "2026-02-27"))
      .first();

    if (!existingFeb) {
      await ctx.db.insert("workouts", {
        planId: plan._id,
        date: "2026-02-27",
        weekNumber: 0,
        dayOfWeek: "Thu",
        type: "easy",
        title: "Pre-Plan Run",
        description: "4km run before training plan started.",
        targetDistance: 4,
        targetPace: undefined,
        completed: true,
        actualDistance: 4.03,
        actualDuration: 1627,
        actualPace: "6:44",
        stravaActivityId: "17618122704",
      });
    }

    // Mark the Mar 2 basketball (106-min Evening Workout on Strava)
    const existingMar2 = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", "2026-03-02"))
      .first();

    if (!existingMar2) {
      await ctx.db.insert("workouts", {
        planId: plan._id,
        date: "2026-03-02",
        weekNumber: 0,
        dayOfWeek: "Mon",
        type: "basketball",
        title: "Basketball",
        description: "Pre-plan basketball session (106 min on Strava).",
        completed: true,
        actualDuration: 6360,
      });
    }

    return "Baseline runs added";
  },
});
