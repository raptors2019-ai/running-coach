import { isRunningType } from "./stravaMapping";
import type { Slot } from "./slots";

/** The fields of a workouts row the matcher reads. */
export type MatchableRun = {
  _id: string;
  date: string;
  type: string;
  title: string;
  completed: boolean;
  actualDistance?: number;
  actualDuration?: number;
  originalType?: string;
};

const QUALITY_TYPES = new Set(["intervals", "tempo", "race_pace", "race"]);
const MIN_QUALITY_KM = 3;
const LONG_REACH = 0.8; // a long slot's run covers most of its target distance
const LONG_FALLBACK_KM = 8; // when the slot names no distance
const QUALITY_MARGIN_SEC = 15; // quality must beat the long run's pace by this much per km
const EASY_FLOOR_SEC = 6 * 60 + 45; // 6:45/km, the fast end of zone 2

const isSegment = (title: string) => title.startsWith("Warmup —") || title.startsWith("Cooldown —");
const isRun = (r: MatchableRun) => isRunningType(r.type) || (r.originalType ? isRunningType(r.originalType) : false);
const isQualityTyped = (r: MatchableRun) => QUALITY_TYPES.has(r.type) || (r.originalType ? QUALITY_TYPES.has(r.originalType) : false);
const secPerKm = (r: MatchableRun) =>
  r.actualDuration && r.actualDistance ? r.actualDuration / r.actualDistance : Number.POSITIVE_INFINITY;

/**
 * The runs that can fill a week's slots: logged runs with a distance.
 * Warmup and cooldown rows are pieces of the main session, not runs of
 * their own, so they never fill a slot. The sync only labels them when the
 * day had a planned row — season weeks don't — so a run under 3 km on a
 * day that also has a run of 3 km+ counts as a segment too.
 */
export function weekRuns<T extends MatchableRun>(rows: T[]): T[] {
  const runs = rows.filter((r) => r.completed && (r.actualDistance ?? 0) > 0 && isRun(r) && !isSegment(r.title));
  const daysWithMainEffort = new Set(
    runs.filter((r) => (r.actualDistance ?? 0) >= MIN_QUALITY_KM).map((r) => r.date)
  );
  return runs.filter((r) => (r.actualDistance ?? 0) >= MIN_QUALITY_KM || !daysWithMainEffort.has(r.date));
}

/**
 * Decide which run fills which slot. Derived at read time, never stored, so
 * a Strava re-sync can never leave a stale fill. Order:
 *   1. pins, then quality-typed runs (a session the plan named)
 *   2. a long slot takes the longest run that reaches most of its distance
 *   3. quality takes the fastest remaining run of 3 km+ — but only if it was
 *      clearly quicker than easy running (15 s/km under the long run's pace,
 *      or under 6:45/km). Interval sessions average slower than their reps
 *      yet still beat easy days; two easy runs leave quality honestly open.
 *   4. an unfilled long slot takes the longest run left, easy slots the rest.
 * Whatever is left over is an extra run.
 */
export function fillSlots<T extends MatchableRun>(
  slots: Slot[],
  runs: T[]
): { fills: Record<string, T | null>; extras: T[] } {
  const fills: Record<string, T | null> = {};
  for (const s of slots) fills[s.id] = null;
  let remaining = [...runs];
  const take = (slotId: string, r: T | undefined) => {
    if (!r) return;
    fills[slotId] = r;
    remaining = remaining.filter((x) => x !== r);
  };
  const open = slots.filter((s) => !s.skipped);
  const unfilled = (kind: Slot["kind"]) => open.filter((s) => s.kind === kind && !fills[s.id]);
  const longestFirst = () => [...remaining].sort((a, b) => (b.actualDistance ?? 0) - (a.actualDistance ?? 0));

  for (const s of open) {
    if (s.pinnedWorkoutId) take(s.id, remaining.find((r) => r._id === s.pinnedWorkoutId));
  }
  for (const s of unfilled("quality")) take(s.id, remaining.find(isQualityTyped));

  for (const s of unfilled("long")) {
    const reach = s.targetDistance ? s.targetDistance * LONG_REACH : LONG_FALLBACK_KM;
    take(s.id, longestFirst().find((r) => (r.actualDistance ?? 0) >= reach));
  }

  const longPaces = open
    .filter((s) => s.kind === "long" && fills[s.id])
    .map((s) => secPerKm(fills[s.id] as T));
  const qualityCutoff = longPaces.length ? Math.min(...longPaces) - QUALITY_MARGIN_SEC : EASY_FLOOR_SEC;
  for (const s of unfilled("quality")) {
    const fastest = remaining
      .filter((r) => (r.actualDistance ?? 0) >= MIN_QUALITY_KM && secPerKm(r) < qualityCutoff)
      .sort((a, b) => secPerKm(a) - secPerKm(b))[0];
    take(s.id, fastest);
  }

  for (const s of unfilled("long")) take(s.id, longestFirst()[0]);
  for (const s of unfilled("easy")) take(s.id, longestFirst()[0]);

  return { fills, extras: remaining };
}

/**
 * The planned side of a season week's stats, from its slots: required slots
 * are the plan, the quality slot's fill says whether the key session happened.
 */
export function slotWeekStats(slots: Slot[], fills: Record<string, { actualPace?: string } | null>) {
  const live = slots.filter((s) => !s.skipped);
  const required = live.filter((s) => !s.optional);
  const quality = live.find((s) => s.kind === "quality");
  const qualityRun = quality ? fills[quality.id] : null;
  return {
    runsPlanned: required.length,
    plannedKm: Math.round(required.reduce((km, s) => km + (s.targetDistance ?? 0), 0) * 10) / 10,
    qualityTitle: quality?.title,
    qualityCompleted: !!qualityRun,
    qualityPace: qualityRun?.actualPace,
  };
}
