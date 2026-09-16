import { addDays, format, parseISO } from "date-fns";
import { RUNNING_TYPES, WORKOUT_TYPE_LABELS } from "./constants";
import { calculatePace, paceToSeconds, secondsToPace } from "./pace-utils";
import { getWeekBounds } from "./weekly-stats";

/**
 * Which sessions the card owns up to: the runs alone, or every meaningful
 * workout of the week — lifts, swims and cross-training included.
 */
export type RecapMode = "runs" | "all";

/**
 * Under a kilometre is a stray GPS start or a walk to the car, not a run.
 * Standalone warm-ups land here too.
 */
export const MIN_MEANINGFUL_KM = 1;

/** A lift or a swim shorter than this was a stretch, not a session. */
export const MIN_MEANINGFUL_SECONDS = 10 * 60;

/** The slice of a workout row a recap card needs. */
export interface RecapWorkout {
  date: string;
  weekNumber: number;
  type: string;
  title: string;
  completed: boolean;
  targetDistance?: number;
  actualDistance?: number;
  actualDuration?: number;
  actualPace?: string;
  avgHeartRate?: number;
}

export interface RecapEntry {
  date: string;
  day: string; // "Tue"
  dayLabel: string; // "Tue Sep 1"
  type: string;
  typeLabel: string; // "Intervals"
  /** "STRENGTH" / "SWIM" / "CROSS-TRAIN" — what a session row is tagged as. */
  categoryLabel: string;
  title: string;
  /** False for the lifts, swims and cross-training of an "all" recap. */
  isRun: boolean;
  /** 0 for a session that covers no ground. */
  distanceKm: number;
  durationSeconds?: number;
  /** "5:12" — measured when Strava has numbers, else the planned target. */
  pace?: string;
  paceSeconds?: number;
  avgHeartRate?: number;
  isFastest: boolean;
  isLongest: boolean;
}

export interface RecapDay {
  date: string;
  day: string; // "Mon"
  km: number;
  /** A non-run session landed here — only ever set in "all" mode. */
  session: boolean;
}

export interface WeekRecap {
  mode: RecapMode;
  weekNumber: number;
  weekLabel: string; // "Week 3"
  weekTitle?: string; // "VO2max"
  weekStart: string; // Monday
  weekEnd: string; // Sunday
  /** "Aug 25 – Aug 30", spanning the days that actually hold workouts. */
  rangeLabel: string;
  /** What the card lists, in date order: runs, plus sessions in "all" mode. */
  entries: RecapEntry[];
  /** The running subset of `entries` — every distance and pace stat comes from here. */
  runs: RecapEntry[];
  days: RecapDay[];
  runCount: number;
  /** Non-run sessions in this week, counted whatever the mode. */
  sessionCount: number;
  /** "2 lifts · 1 swim", or "" when the week was runs only. */
  supportSummary: string;
  totalKm: number;
  totalSeconds: number;
  /** Week's distance-weighted average pace, "6:14". */
  avgPace?: string;
  fastestPace?: string;
  longestKm: number;
  plannedRuns: number;
  plannedKm: number;
  /** Runs done ÷ runs planned, clamped to 100 for an over-delivered week. */
  completionPct: number;
}

/** Plan-week names, mirroring the calendar's week headers. */
export const WEEK_TITLES: Record<number, string> = {
  0: "Where it started",
  1: "Rebuild + Benchmark",
  2: "Raw Speed",
  3: "VO2max",
  4: "Race Pace Test",
  5: "Sharpen",
  6: "Taper + Race",
};

const LIFT_TYPES = new Set(["upper_body", "lower_body"]);
/** Everything that is training but covers no ground. Walks arrive as "rest". */
const SESSION_TYPES = new Set(["upper_body", "lower_body", "swim", "cross_training"]);
/** Strava's own adopted runs carry the generic "run" type. */
const RUN_TYPES = new Set([...RUNNING_TYPES, "run"]);

function isRunType(type: string): boolean {
  return RUN_TYPES.has(type);
}

function shortDay(date: string): string {
  return format(parseISO(date), "EEE");
}

function monthDay(date: string): string {
  return format(parseISO(date), "MMM d");
}

/**
 * A completed run's distance: Strava's number when it synced, otherwise the
 * target the quick-complete stood in for. Strava stays the source of truth.
 */
function runDistance(w: RecapWorkout): number {
  return w.actualDistance ?? w.targetDistance ?? 0;
}

function runPaceSeconds(w: RecapWorkout): number | undefined {
  if (w.actualPace) {
    const s = paceToSeconds(w.actualPace);
    if (!Number.isNaN(s)) return s;
  }
  const km = runDistance(w);
  if (w.actualDuration && km > 0) return w.actualDuration / km;
  return undefined;
}

/** Group a plan's workouts by plan week, newest week last. */
export function groupByWeek<T extends { weekNumber: number }>(
  workouts: T[]
): Map<number, T[]> {
  const weeks = new Map<number, T[]>();
  for (const w of workouts) {
    const list = weeks.get(w.weekNumber);
    if (list) list.push(w);
    else weeks.set(w.weekNumber, [w]);
  }
  return new Map([...weeks.entries()].sort(([a], [b]) => a - b));
}

/** Plan weeks that have at least one run logged — the ones worth posting. */
export function weeksWithRuns(workouts: RecapWorkout[]): number[] {
  const weeks = new Set<number>();
  for (const w of workouts) {
    if (w.completed && isRunType(w.type) && runDistance(w) >= MIN_MEANINGFUL_KM) {
      weeks.add(w.weekNumber);
    }
  }
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Build the shareable recap for one plan week. Only completed runs make the
 * card — a recap is a record of work done, not of what was scheduled.
 */
export function buildWeekRecap(
  workouts: RecapWorkout[],
  weekNumber: number,
  mode: RecapMode = "runs"
): WeekRecap | null {
  const inWeek = workouts
    .filter((w) => w.weekNumber === weekNumber)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inWeek.length === 0) return null;

  const planned = inWeek.filter((w) => isRunType(w.type));
  // Sub-kilometre blips are warm-ups and walks, not runs worth posting.
  const done = planned.filter((w) => w.completed && runDistance(w) >= MIN_MEANINGFUL_KM);

  const paces = done.map(runPaceSeconds);
  const fastest = paces.filter((p): p is number => p !== undefined).sort((a, b) => a - b)[0];
  const longestKm = done.reduce((max, w) => Math.max(max, runDistance(w)), 0);

  let fastestTaken = false;
  let longestTaken = false;
  const runs: RecapEntry[] = done.map((w, i) => {
    const paceSeconds = paces[i];
    const distanceKm = runDistance(w);
    // Only one run wears each crown, even when two tie.
    const isFastest = !fastestTaken && paceSeconds !== undefined && paceSeconds === fastest;
    if (isFastest) fastestTaken = true;
    const isLongest = !longestTaken && distanceKm === longestKm && done.length > 1;
    if (isLongest) longestTaken = true;
    return {
      date: w.date,
      day: shortDay(w.date),
      dayLabel: `${shortDay(w.date)} ${monthDay(w.date)}`,
      type: w.type,
      typeLabel: WORKOUT_TYPE_LABELS[w.type] ?? "Run",
      categoryLabel: "RUN",
      title: w.title,
      isRun: true,
      distanceKm,
      durationSeconds: w.actualDuration,
      pace: paceSeconds !== undefined ? secondsToPace(paceSeconds) : undefined,
      paceSeconds,
      avgHeartRate: w.avgHeartRate,
      isFastest,
      isLongest,
    };
  });

  // Lifts, swims and cross-training: real work, no distance. A ten-minute
  // floor keeps a stretch or a mis-started activity off the card.
  const sessions: RecapEntry[] = inWeek
    .filter(
      (w) =>
        w.completed &&
        SESSION_TYPES.has(w.type) &&
        (w.actualDuration === undefined || w.actualDuration >= MIN_MEANINGFUL_SECONDS)
    )
    .map((w) => ({
      date: w.date,
      day: shortDay(w.date),
      dayLabel: `${shortDay(w.date)} ${monthDay(w.date)}`,
      type: w.type,
      typeLabel: WORKOUT_TYPE_LABELS[w.type] ?? "Session",
      categoryLabel: categoryFor(w.type),
      title: w.title,
      isRun: false,
      distanceKm: 0,
      durationSeconds: w.actualDuration,
      avgHeartRate: w.avgHeartRate,
      isFastest: false,
      isLongest: false,
    }));

  const entries =
    mode === "all"
      ? [...runs, ...sessions].sort((a, b) => a.date.localeCompare(b.date))
      : runs;

  const totalKm = Math.round(runs.reduce((sum, r) => sum + r.distanceKm, 0) * 100) / 100;
  const totalSeconds = runs.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
  const timedKm = runs
    .filter((r) => r.durationSeconds)
    .reduce((sum, r) => sum + r.distanceKm, 0);

  const { start, end } = getWeekBounds(inWeek[0].date);
  const kmByDate = new Map<string, number>();
  for (const r of runs) kmByDate.set(r.date, (kmByDate.get(r.date) ?? 0) + r.distanceKm);
  // A session only marks the week's bar chart when the card claims sessions.
  const sessionDates = new Set(mode === "all" ? sessions.map((s) => s.date) : []);
  const days: RecapDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = format(addDays(parseISO(start), i), "yyyy-MM-dd");
    return {
      date,
      day: shortDay(date),
      km: Math.round((kmByDate.get(date) ?? 0) * 100) / 100,
      session: sessionDates.has(date),
    };
  });

  const plannedKm = planned.reduce((sum, w) => sum + (w.targetDistance ?? 0), 0);

  return {
    mode,
    weekNumber,
    weekLabel: weekNumber === 0 ? "Pre-plan" : `Week ${weekNumber}`,
    weekTitle: WEEK_TITLES[weekNumber],
    weekStart: start,
    weekEnd: end,
    rangeLabel: `${monthDay(inWeek[0].date)} – ${monthDay(inWeek[inWeek.length - 1].date)}`,
    entries,
    runs,
    days,
    runCount: runs.length,
    sessionCount: sessions.length,
    supportSummary: summariseSessions(sessions),
    totalKm,
    totalSeconds,
    avgPace: timedKm > 0 ? calculatePace(timedKm, totalSeconds) : undefined,
    fastestPace: fastest !== undefined ? secondsToPace(fastest) : undefined,
    longestKm: Math.round(longestKm * 100) / 100,
    plannedRuns: planned.length,
    plannedKm: Math.round(plannedKm * 100) / 100,
    completionPct:
      planned.length === 0 ? 0 : Math.min(100, Math.round((runs.length / planned.length) * 100)),
  };
}

/** The row tag for a session, which never just repeats its own title. */
function categoryFor(type: string): string {
  if (LIFT_TYPES.has(type)) return "STRENGTH";
  if (type === "swim") return "SWIM";
  return "CROSS-TRAIN";
}

/** "2 lifts · 1 swim" — the week's non-running work, in one line. */
function summariseSessions(sessions: RecapEntry[]): string {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const noun = LIFT_TYPES.has(s.type) ? "lift" : s.type === "swim" ? "swim" : "cross-train";
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([noun, n]) => (noun === "cross-train" ? `${n} cross-train` : `${n} ${noun}${n > 1 ? "s" : ""}`))
    .join(" · ");
}

/** The caption Josh's post leads with. Short by design — it has to fit big. */
export function defaultCaption(recap: WeekRecap): string {
  return recap.runCount === 0
    ? "s/o to me for showing up"
    : "s/o to me for putting in the work";
}

/** The one-line boast under the caption: how the week went against the plan. */
export function weekHighlight(recap: WeekRecap): string {
  if (recap.runCount === 0) return "";
  if (recap.plannedRuns === 0) return "Before the plan even started";
  if (recap.runCount >= recap.plannedRuns) return "Every run on the board";
  return `${recap.runCount} of ${recap.plannedRuns} runs in the bank`;
}

/**
 * Greedy word wrap for SVG text, which has no line box of its own.
 * Returns at most `maxLines` lines, ellipsing whatever doesn't fit.
 */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]$/, "")}…`;
  return kept;
}

/** Clip a title to fit a fixed-width SVG row. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
