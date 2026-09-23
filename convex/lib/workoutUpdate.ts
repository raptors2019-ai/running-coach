import type { Interval } from "./planSwap";

export type WorkoutUpdateFields = {
  type?: string;
  title?: string;
  description?: string;
  targetDistance?: number;
  targetPace?: string;
  intervals?: Interval[];
};

/**
 * The patch for a coach edit: only the fields the coach sent change. An empty
 * `intervals` list clears the rep table (stored as absent), so a session that
 * stops being intervals doesn't keep showing stale reps.
 */
export function workoutUpdatePatch(fields: WorkoutUpdateFields): WorkoutUpdateFields {
  const patch: WorkoutUpdateFields = Object.fromEntries(
    Object.entries(fields).filter(([, val]) => val !== undefined)
  );
  if (fields.intervals !== undefined && fields.intervals.length === 0) {
    patch.intervals = undefined;
  }
  return patch;
}
