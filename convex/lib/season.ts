import type { Slot } from "./slots";

/**
 * Season date maths, shared by Convex functions and the UI. A season is a
 * Monday-to-Sunday stretch split into phases, with checkpoint time trials on
 * target weekends. All dates are YYYY-MM-DD.
 */
export type SeasonPhase = { key: string; name: string; startDate: string; endDate: string; focus: string };
export type SeasonCheckpoint = {
  date: string;
  label: string;
  distanceKm: number;
  aimSeconds?: number;
  isGoal: boolean;
  resultSeconds?: number;
};
export type SeasonGoal = { label: string; distanceKm: number; targetSeconds: number; byDate: string };
export type SeasonLike = {
  startDate: string;
  endDate: string;
  goals: SeasonGoal[];
  phases: SeasonPhase[];
  checkpoints: SeasonCheckpoint[];
};

const DAY_MS = 86_400_000;
const noon = (date: string) => new Date(date + "T12:00:00");

export function addDaysIso(date: string, days: number): string {
  const d = noon(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / DAY_MS);
}

/** Monday of the week containing the date (training weeks run Mon–Sun). */
export function mondayOf(date: string): string {
  const dow = noon(date).getDay(); // 0 = Sunday
  return addDaysIso(date, -(dow === 0 ? 6 : dow - 1));
}

export function findActiveSeason<T extends SeasonLike>(seasons: T[], today: string): T | null {
  return seasons.find((s) => s.startDate <= today && today <= s.endDate) ?? null;
}

/** 1-based week of the season. */
export function seasonWeekIndex(season: SeasonLike, date: string): number {
  return Math.floor(daysBetween(season.startDate, mondayOf(date)) / 7) + 1;
}

export function phaseFor(season: SeasonLike, date: string) {
  const index = season.phases.findIndex((p) => p.startDate <= date && date <= p.endDate);
  if (index < 0) return null;
  const phase = season.phases[index];
  return {
    phase,
    index,
    weekInPhase: Math.floor(daysBetween(phase.startDate, mondayOf(date)) / 7) + 1,
    weeksInPhase: Math.round((daysBetween(phase.startDate, phase.endDate) + 1) / 7),
  };
}

/** How far through the season a date is, 0..1 — positions the trail marker. */
export function seasonProgress(season: SeasonLike, date: string): number {
  const total = daysBetween(season.startDate, season.endDate);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(season.startDate, date) / total));
}

export function nextCheckpoint(season: SeasonLike, today: string) {
  const checkpoint = [...season.checkpoints].sort((a, b) => a.date.localeCompare(b.date)).find((c) => c.date >= today);
  return checkpoint ? { checkpoint, daysAway: daysBetween(today, checkpoint.date) } : null;
}

type Fills = Record<string, unknown | null>;

/** "1 of 2–3": filled slots over required slots, with the optional ones as the range's top. */
export function slotProgress(slots: Slot[], fills: Fills) {
  const live = slots.filter((s) => !s.skipped);
  const done = live.filter((s) => fills[s.id]).length;
  const required = live.filter((s) => !s.optional).length;
  const total = live.length;
  const label = required === total ? `${done} of ${total}` : `${done} of ${required}–${total}`;
  return { done, required, total, label };
}

const KIND_ORDER: Record<Slot["kind"], number> = { quality: 0, long: 1, easy: 2 };

/**
 * The slot to nudge toward next: an open required slot (quality first, since
 * it matters most), else an open optional one.
 */
export function upNextSlot(slots: Slot[], fills: Fills): Slot | null {
  const open = slots
    .filter((s) => !s.skipped && !fills[s.id])
    .sort((a, b) => Number(a.optional) - Number(b.optional) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return open[0] ?? null;
}

/** Today's date in Toronto, where the athlete lives. */
export function todayToronto(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}
