import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  optimizeSchedule,
  type DayForecast,
  type WorkoutSlot,
  type OptimizationResult,
} from "./lib/weatherOptimizer";
import type { Id } from "./_generated/dataModel";

export const optimizeUpcomingWorkouts = action({
  handler: async (ctx): Promise<OptimizationResult> => {
    // 1. Fetch fresh forecast
    await ctx.runAction(api.weather.fetchForecast);

    // 2. Get today's date in Toronto timezone
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Toronto",
    });
    const endDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

    // 3. Read forecast and workouts
    const forecastRows = await ctx.runQuery(api.weather.getForecast, {
      startDate: today,
    });
    const workoutRows = await ctx.runQuery(api.workouts.getUpcomingWorkouts, {
      startDate: today,
      endDate,
    });

    // 4. Map to optimizer types
    const forecast: DayForecast[] = forecastRows
      .filter(
        (f) =>
          f.conditionAm !== undefined &&
          f.conditionPm !== undefined
      )
      .map((f) => ({
        date: f.date,
        conditionAm: f.conditionAm!,
        conditionPm: f.conditionPm!,
        temperatureAm: f.temperatureAm ?? f.temperature,
        temperaturePm: f.temperaturePm ?? f.temperature,
        precipitationAm: f.precipitationAm ?? f.precipitation,
        precipitationPm: f.precipitationPm ?? f.precipitation,
        windSpeedAm: f.windSpeedAm ?? f.windSpeed,
        windSpeedPm: f.windSpeedPm ?? f.windSpeed,
      }));

    const workouts: WorkoutSlot[] = workoutRows.map((w) => ({
      id: w._id as string,
      date: w.date,
      type: w.type,
      title: w.title,
      completed: w.completed,
      weekNumber: w.weekNumber,
      targetDistance: w.targetDistance,
      isUnplanned: w.isUnplanned,
    }));

    // 5. Run optimizer
    return optimizeSchedule(workouts, forecast);
  },
});

export const applyOptimization = action({
  args: {
    swaps: v.array(
      v.object({
        workout1Id: v.string(),
        workout2Id: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const swap of args.swaps) {
      await ctx.runMutation(api.workouts.swapWorkoutDates, {
        workoutId1: swap.workout1Id as Id<"workouts">,
        workoutId2: swap.workout2Id as Id<"workouts">,
      });
    }
  },
});
