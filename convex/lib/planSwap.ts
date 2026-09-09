/**
 * Moving a workout on the calendar moves the *plan*, never the history. A
 * date's completion, Strava numbers and notes belong to that date; what gets
 * exchanged between two rows is only what was planned for them.
 */
export type Interval = { distance: string; pace: string; rest: string; reps: number };

export type PlanFields = {
  type: string;
  title: string;
  description: string;
  targetDistance?: number;
  targetPace?: string;
  intervals?: Interval[];
};

type PlanRow = PlanFields & { originalType?: string };

/**
 * Every plan field is present (explicitly `undefined` when absent) so a
 * Convex `patch` clears stale intervals or targets rather than keeping them.
 */
export type PlanPatch = {
  type: string;
  title: string;
  description: string;
  targetDistance: number | undefined;
  targetPace: string | undefined;
  intervals: Interval[] | undefined;
  originalType: undefined;
  missedAt: undefined;
};

/** The plan as it was written, before any Strava sync relabelled the row. */
function asPatch(row: PlanRow): PlanPatch {
  return {
    type: row.originalType ?? row.type,
    title: row.title,
    description: row.description,
    targetDistance: row.targetDistance,
    targetPace: row.targetPace,
    intervals: row.intervals,
    // Both rows come out of a swap freshly planned: no sync override, no missed flag.
    originalType: undefined,
    missedAt: undefined,
  };
}

/** Patches that give row A row B's plan and vice versa. */
export function swapPlanPatches(a: PlanRow, b: PlanRow): [PlanPatch, PlanPatch] {
  return [asPatch(b), asPatch(a)];
}
