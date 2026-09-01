import { mutation } from "./_generated/server";
import { formatPaceWithUnit } from "./lib/stravaMapping";

/**
 * Records the Aug 27 2K TT benchmark outcome durably, whether or not the
 * Strava sync ever matched the activity. Idempotent: safe to run after a
 * successful sync (keeps the synced numbers, only adds the decision note)
 * or before one (fills in the numbers from Strava activity 19928661458).
 *
 * Run with: npx convex run backfill:recordBenchmarkResult
 */
export const recordBenchmarkResult = mutation({
  handler: async (ctx) => {
    const DATE = "2026-08-27";
    const STRAVA_ID = "19928661458";
    const DISTANCE_KM = 1.98;
    const DURATION_S = 552; // 9:12
    const NOTE =
      "Checkpoint 1 — 2K TT benchmark: 1.98 km in 9:12 (4:39/km on Strava, ~9:18 scaled to a full 2 km; best estimated 1K 4:38, fastest mile 7:31). " +
      "Well under the 9:50 bar → decision: chase 24:30. No retest needed — next checkpoint is the Sep 15 race pace test (3K @ 5:00/km).";

    const rows = await ctx.db
      .query("workouts")
      .withIndex("by_date", (q) => q.eq("date", DATE))
      .collect();
    const benchmark = rows.find((w) => !w.isUnplanned && w.type === "race_pace")
      ?? rows.find((w) => !w.isUnplanned)
      ?? rows[0];

    if (benchmark) {
      if (benchmark.notes?.includes("Checkpoint 1")) {
        return "Benchmark result already recorded";
      }
      await ctx.db.patch(benchmark._id, {
        completed: true,
        // A successful Strava sync already holds the real numbers — keep them.
        ...(benchmark.stravaActivityId
          ? {}
          : {
              actualDistance: DISTANCE_KM,
              actualDuration: DURATION_S,
              actualPace: formatPaceWithUnit(DISTANCE_KM, DURATION_S),
              stravaActivityId: STRAVA_ID,
            }),
        notes: benchmark.notes ? `${benchmark.notes}\n${NOTE}` : NOTE,
      });
      return `Benchmark result recorded on existing ${benchmark.title}`;
    }

    const plan = await ctx.db.query("trainingPlan").first();
    if (!plan) throw new Error("No training plan found");
    await ctx.db.insert("workouts", {
      planId: plan._id,
      date: DATE,
      weekNumber: 1,
      dayOfWeek: "Thu",
      type: "race_pace",
      title: "BENCHMARK: 2K Time Trial",
      description:
        "WU 1.5km + 2km hard (controlled all-out) + CD 1km. This calibrates the whole plan.",
      targetDistance: 4.5,
      targetPace: "4:45-5:15",
      completed: true,
      actualDistance: DISTANCE_KM,
      actualDuration: DURATION_S,
      actualPace: formatPaceWithUnit(DISTANCE_KM, DURATION_S),
      stravaActivityId: STRAVA_ID,
      notes: NOTE,
    });
    return "Benchmark workout created with result";
  },
});

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
