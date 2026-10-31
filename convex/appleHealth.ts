import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  appleWorkoutValidator,
  isAppleId,
  isRunActivity,
  isSameActivity,
  toSyncedActivity,
  type AppleWorkout,
} from "./lib/appleHealth";
import { autoCompleteActivities } from "./workouts";

async function rowsOn(ctx: MutationCtx, date: string) {
  return await ctx.db
    .query("workouts")
    .withIndex("by_date", (q) => q.eq("date", date))
    .collect();
}

/**
 * The Strava-synced row on the workout's date that records the same
 * workout, if any. Strava rows don't store a start time; activityRoutes does
 * for GPS activities, so that's used when present (see isSameActivity for
 * the fallback).
 */
async function stravaDuplicate(ctx: MutationCtx, workout: AppleWorkout) {
  const candidate = {
    startTime: workout.startTime,
    durationS: workout.durationS,
    isRun: isRunActivity(toSyncedActivity(workout).mappedType),
  };
  for (const row of await rowsOn(ctx, workout.date)) {
    const stravaId = row.stravaActivityId;
    if (!stravaId || isAppleId(stravaId) || row.actualDuration === undefined) continue;
    const route = await ctx.db
      .query("activityRoutes")
      .withIndex("by_strava_id", (q) => q.eq("stravaId", stravaId))
      .first();
    const existing = { startTime: route?.startTime, durationS: row.actualDuration, isRun: isRunActivity(row.type) };
    if (isSameActivity(candidate, existing)) return row;
  }
  return null;
}

async function workoutIdFor(ctx: MutationCtx, date: string, activityId: string): Promise<Id<"workouts"> | undefined> {
  return (await rowsOn(ctx, date)).find((w) => w.stravaActivityId === activityId)?._id;
}

/**
 * One Apple Health workout from POST /apple-health/workout. Idempotent on
 * the Shortcut's id; a workout Strava already recorded only stores its
 * detail against the Strava row. Otherwise it goes through the same matching
 * as a Strava activity (autoCompleteActivities), in this one transaction.
 */
export const ingestWorkout = internalMutation({
  args: { workout: appleWorkoutValidator },
  handler: async (ctx, { workout }) => {
    const seen = await ctx.db
      .query("activityDetails")
      .withIndex("by_activity_id", (q) => q.eq("activityId", workout.activityId))
      .first();
    if (seen) return { status: "duplicate" as const, workoutId: seen.workoutId };

    const detail = { ...workout, source: "apple_health" as const, receivedAt: Date.now() };

    const strava = await stravaDuplicate(ctx, workout);
    if (strava) {
      await ctx.db.insert("activityDetails", { ...detail, workoutId: strava._id, duplicateOf: strava.stravaActivityId });
      return { status: "duplicate_of_strava" as const, workoutId: strava._id };
    }

    const result = await autoCompleteActivities(ctx, [toSyncedActivity(workout)]);
    const workoutId = await workoutIdFor(ctx, workout.date, workout.activityId);
    await ctx.db.insert("activityDetails", { ...detail, workoutId });
    return { status: "created" as const, workoutId, ...result };
  },
});

/**
 * Re-imports a date's Apple Health workouts after coachRematchDate cleared
 * the day, so a rematch rebuilds from the stored detail instead of losing the
 * rows (there's nothing to re-fetch: the Shortcut pushes once). A workout
 * that had deferred to a Strava row whose sync state was just cleared is
 * imported in its own right; a later Strava sync then defers to it.
 */
export async function replayAppleDate(ctx: MutationCtx, date: string): Promise<number> {
  const details = await ctx.db
    .query("activityDetails")
    .withIndex("by_date", (q) => q.eq("date", date))
    .collect();
  if (details.length === 0) return 0;
  const syncedIds = new Set((await rowsOn(ctx, date)).map((w) => w.stravaActivityId));
  const replay = details.filter((d) => !d.duplicateOf || !syncedIds.has(d.duplicateOf));
  await autoCompleteActivities(ctx, replay.map(toSyncedActivity));
  for (const d of replay) {
    await ctx.db.patch(d._id, { workoutId: await workoutIdFor(ctx, date, d.activityId), duplicateOf: undefined });
  }
  return replay.length;
}
