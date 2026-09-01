import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { isRunType } from "./constants";

export interface WeekBounds {
  start: string; // Monday, YYYY-MM-DD
  end: string; // Sunday, YYYY-MM-DD
}

/** Monday–Sunday bounds of the week containing `date`, matching plan weeks. */
export function getWeekBounds(date: string): WeekBounds {
  const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return {
    start: format(monday, "yyyy-MM-dd"),
    end: format(addDays(monday, 6), "yyyy-MM-dd"),
  };
}

export interface WeekWorkout {
  date: string;
  type: string;
  title?: string;
  completed: boolean;
  targetDistance?: number;
  actualDistance?: number;
  isUnplanned?: boolean;
  missedAt?: number;
  originalType?: string;
}

/**
 * What a training week looks like in terms of runs — the number the athlete
 * actually cares about. Strength and cross-training sessions are tracked
 * separately so they never inflate the run count or the km.
 */
export interface WeekSummary {
  /** Runs on the plan (not Strava extras). */
  runsPlanned: number;
  /** Planned runs that got done — including ones made up on another day. */
  runsDone: number;
  /** Planned runs whose day passed with nothing logged. */
  runsMissed: number;
  /** Runs logged that weren't on the plan (Strava imports on a non-run day). */
  extraRuns: number;
  /** Target km of all planned runs. */
  plannedKm: number;
  /** Km actually run this week: planned runs done plus extras. */
  actualKm: number;
  /** Non-run sessions on the plan (lifts, cross-training, swims). */
  otherPlanned: number;
  otherDone: number;
}

/** Warmup/cooldown recorded separately from a matched session — km, not a run. */
const isSegmentRow = (title?: string) => !!title && /^(Warmup|Cooldown) —/.test(title);

const round1 = (n: number) => Math.round(n * 10) / 10;

export function getWeekSummary(workouts: WeekWorkout[]): WeekSummary {
  const s: WeekSummary = {
    runsPlanned: 0,
    runsDone: 0,
    runsMissed: 0,
    extraRuns: 0,
    plannedKm: 0,
    actualKm: 0,
    otherPlanned: 0,
    otherDone: 0,
  };

  for (const w of workouts) {
    const isRun = isRunType(w.type);

    if (w.isUnplanned) {
      if (isRun && w.completed) {
        s.actualKm += w.actualDistance ?? 0;
        if (!isSegmentRow(w.title)) s.extraRuns++;
      }
      continue;
    }

    // A planned run that Strava re-typed (did a lift instead) still counts as
    // a run the plan asked for; it just didn't get done.
    const plannedAsRun = isRun || (!!w.originalType && isRunType(w.originalType));
    if (plannedAsRun) {
      s.runsPlanned++;
      s.plannedKm += w.targetDistance ?? 0;
      if (w.completed && isRun) {
        s.runsDone++;
        s.actualKm += w.actualDistance ?? w.targetDistance ?? 0;
      } else if (!w.completed && w.missedAt) {
        s.runsMissed++;
      }
    } else if (w.type !== "rest") {
      s.otherPlanned++;
      if (w.completed) s.otherDone++;
    }
  }

  s.plannedKm = round1(s.plannedKm);
  s.actualKm = round1(s.actualKm);
  return s;
}

/** Summary of the Monday–Sunday week containing `today`. */
export function getWeeklyStats(workouts: WeekWorkout[], today: string): WeekSummary {
  const { start, end } = getWeekBounds(today);
  return getWeekSummary(workouts.filter((w) => w.date >= start && w.date <= end));
}
