import { paceToSeconds, riegelPrediction } from "./pace-utils";
import { RACE_DISTANCE_KM, RUNNING_TYPES } from "./constants";

/**
 * April 18 Foxtrail: 56:50 for 10.3 km (5:31/km) converts to a ~26:25 5K.
 * This is the "where you started" anchor the plan is written against.
 */
export const BASELINE_5K_SECONDS = 26 * 60 + 25;
export const BASELINE_LABEL = "Apr 18 Foxtrail (26:25 5K equiv.)";

/** Workout types where the logged pace reflects a genuine race-like effort. */
export const HARD_EFFORT_TYPES = new Set(["race_pace", "race", "tempo"]);

/** Only hard efforts this recent say anything about current fitness. */
const HARD_EFFORT_LOOKBACK_DAYS = 56;
const MIN_HARD_EFFORT_KM = 1.5;
const MIN_EASY_EFFORT_KM = 3;

export interface ProgressWorkout {
  _id: string;
  date: string;
  type: string;
  title: string;
  completed: boolean;
  actualDistance?: number;
  actualDuration?: number;
  actualPace?: string;
  avgHeartRate?: number;
  isUnplanned?: boolean;
  notes?: string;
}

export interface ProgressCheckpoint {
  key: string;
  date: string;
  resultSeconds?: number;
  resultDistanceKm?: number;
  decision: string;
  goalSeconds?: number;
}

/** Strava creates unplanned runs with type "run"; the plan uses named run types. */
export function isRunWorkout(type: string): boolean {
  return type === "run" || RUNNING_TYPES.has(type);
}

export function isHardEffort(type: string): boolean {
  return HARD_EFFORT_TYPES.has(type);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

export interface PredictionBasis {
  kind: "hard" | "easy";
  workout: ProgressWorkout;
  predictedSeconds: number;
}

/**
 * Pick the run that should drive the race prediction.
 *
 * Riegel only means something when the input was a real effort, so hard
 * workouts (time trial, race-pace test, tempo) within the lookback window
 * win outright — the one with the fastest 5K equivalent. Only when there is
 * no hard effort at all do we fall back to the most recent run of at least
 * 3 km, and the caller is told it is an easy-run extrapolation.
 */
export function selectPredictionBasis(
  workouts: ProgressWorkout[],
  today: string
): PredictionBasis | null {
  const runs = workouts.filter(
    (w) => w.completed && isRunWorkout(w.type) && w.actualDistance && w.actualDuration
  );

  const hard = runs
    .filter(
      (w) =>
        isHardEffort(w.type) &&
        w.actualDistance! >= MIN_HARD_EFFORT_KM &&
        daysBetween(w.date, today) <= HARD_EFFORT_LOOKBACK_DAYS
    )
    .map((w) => ({
      kind: "hard" as const,
      workout: w,
      predictedSeconds: riegelPrediction(w.actualDistance!, w.actualDuration!, RACE_DISTANCE_KM),
    }))
    .sort((a, b) => a.predictedSeconds - b.predictedSeconds);
  if (hard.length > 0) return hard[0];

  const easy = runs
    .filter((w) => w.actualDistance! >= MIN_EASY_EFFORT_KM)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (easy.length === 0) return null;
  const w = easy[0];
  return {
    kind: "easy",
    workout: w,
    predictedSeconds: riegelPrediction(w.actualDistance!, w.actualDuration!, RACE_DISTANCE_KM),
  };
}

/** The goal a passed checkpoint may have upgraded, else the plan's goal. */
export function effectiveGoalSeconds(
  plan: { goalTime: number } | null | undefined,
  checkpoints: ProgressCheckpoint[]
): number {
  const upgraded = [...checkpoints]
    .filter((c) => c.goalSeconds !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return upgraded?.goalSeconds ?? plan?.goalTime ?? 25 * 60;
}

export interface PacePoint {
  date: string;
  ts: number;
  title: string;
  type: string;
  hardSeconds?: number;
  easySeconds?: number;
}

/** Chart series: every run with a parseable pace, split by effort kind. */
export function buildPaceSeries(workouts: ProgressWorkout[]): PacePoint[] {
  return workouts
    .filter((w) => w.completed && isRunWorkout(w.type) && w.actualPace)
    .map((w) => ({ w, seconds: paceToSeconds(w.actualPace!) }))
    .filter(({ seconds }) => !Number.isNaN(seconds))
    .sort((a, b) => a.w.date.localeCompare(b.w.date))
    .map(({ w, seconds }) => ({
      date: w.date,
      ts: new Date(w.date + "T12:00:00").getTime(),
      title: w.title,
      type: w.type,
      ...(isHardEffort(w.type) ? { hardSeconds: seconds } : { easySeconds: seconds }),
    }));
}

/** Most recent running activities, newest first. */
export function recentRuns<T extends ProgressWorkout>(workouts: T[], limit: number): T[] {
  return workouts
    .filter((w) => w.completed && isRunWorkout(w.type) && (w.actualDistance || w.actualDuration))
    // Same day: the planned session (the day's main effort) before its
    // separately recorded warmup/cooldown segments.
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Number(a.isUnplanned ?? false) - Number(b.isUnplanned ?? false)
    )
    .slice(0, limit);
}
