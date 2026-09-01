import { isRunningType } from "./stravaMapping";

/**
 * Crediting an unplanned run to a planned one it stood in for — the Sunday
 * long run that got done on Monday. Pure helpers so the pairing rules are
 * testable outside Convex.
 */

export interface MakeUpWorkout {
  _id: string;
  planId: string;
  date: string;
  type: string;
  title: string;
  completed: boolean;
  isUnplanned?: boolean;
  missedAt?: number;
  targetDistance?: number;
  actualDistance?: number;
}

/** How far apart (days) a run and the planned slot it covers may be. */
export const MAKE_UP_WINDOW_DAYS = 7;

const isSegmentRow = (title: string) => /^(Warmup|Cooldown) —/.test(title);

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Can `run` (a completed unplanned run) be counted as `planned` (an undone
 * planned run)? Either direction in time: made up late, or done early.
 */
export function canCountRunAsPlanned(planned: MakeUpWorkout, run: MakeUpWorkout): boolean {
  if (planned.isUnplanned || planned.completed || !isRunningType(planned.type)) return false;
  if (!run.isUnplanned || !run.completed || !isRunningType(run.type)) return false;
  if (isSegmentRow(run.title)) return false; // warmup/cooldown of a matched session
  if (planned.planId !== run.planId) return false;
  return Math.abs(daysBetween(planned.date, run.date)) <= MAKE_UP_WINDOW_DAYS;
}

/**
 * The other half of a possible pairing for `workout`: planned runs an extra
 * run could cover, or extra runs that could cover a planned run. Closest
 * dates first.
 */
export function makeUpCandidates<T extends MakeUpWorkout>(workout: T, all: T[]): T[] {
  const matches = workout.isUnplanned
    ? all.filter((w) => canCountRunAsPlanned(w, workout))
    : all.filter((w) => canCountRunAsPlanned(workout, w));
  return matches.sort((a, b) => {
    const da = Math.abs(daysBetween(workout.date, a.date));
    const db = Math.abs(daysBetween(workout.date, b.date));
    return da - db || a.date.localeCompare(b.date);
  });
}

/** "Mon, Aug 31" — for notes written into the workout row. */
export function shortDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
