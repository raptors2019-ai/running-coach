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

const isSegment = (title: string) => title.startsWith("Warmup —") || title.startsWith("Cooldown —");
const isRun = (r: MatchableRun) => isRunningType(r.type) || (r.originalType ? isRunningType(r.originalType) : false);
const isQualityTyped = (r: MatchableRun) => QUALITY_TYPES.has(r.type) || (r.originalType ? QUALITY_TYPES.has(r.originalType) : false);
const secPerKm = (r: MatchableRun) =>
  r.actualDuration && r.actualDistance ? r.actualDuration / r.actualDistance : Number.POSITIVE_INFINITY;

/**
 * The runs that can fill a week's slots: logged runs with a distance.
 * Warmup and cooldown rows are pieces of the main session, not runs of
 * their own, so they never fill a slot.
 */
export function weekRuns<T extends MatchableRun>(rows: T[]): T[] {
  return rows.filter((r) => r.completed && (r.actualDistance ?? 0) > 0 && isRun(r) && !isSegment(r.title));
}

/**
 * Decide which run fills which slot. Derived at read time, never stored, so
 * a Strava re-sync can never leave a stale fill. Order: pins, then quality
 * (a quality-typed run, else the fastest run of 3 km+ — interval sessions
 * average slower than their reps but still beat easy runs), then long
 * (longest), then easy (longest first). Whatever is left is an extra run.
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

  for (const s of open) {
    if (s.pinnedWorkoutId) take(s.id, remaining.find((r) => r._id === s.pinnedWorkoutId));
  }
  const unfilled = (kind: Slot["kind"]) => open.filter((s) => s.kind === kind && !fills[s.id]);

  for (const s of unfilled("quality")) {
    const typed = remaining.find(isQualityTyped);
    const fastest = remaining
      .filter((r) => (r.actualDistance ?? 0) >= MIN_QUALITY_KM)
      .sort((a, b) => secPerKm(a) - secPerKm(b))[0];
    take(s.id, typed ?? fastest);
  }
  const longestFirst = () => [...remaining].sort((a, b) => (b.actualDistance ?? 0) - (a.actualDistance ?? 0));
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
