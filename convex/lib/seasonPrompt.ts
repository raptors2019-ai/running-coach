import type { Slot } from "./slots";

type RunLike = {
  date: string;
  dayOfWeek: string;
  actualDistance?: number;
  actualPace?: string;
  avgHeartRate?: number;
};

export type SeasonWeekLike = {
  weekStart: string;
  plan: { status: string; note?: string } | null;
  slots: Slot[];
  fills: Record<string, RunLike | null>;
  extras: RunLike[];
  crossTraining: { type: string; title: string; actualDistance?: number }[];
  totals: { runKm: number; runs: number; crossCount: number };
};

const runForPrompt = (r: RunLike) => ({
  date: r.date,
  day: r.dayOfWeek,
  km: r.actualDistance,
  pace: r.actualPace,
  hr: r.avgHeartRate,
});

/**
 * A season week as the coach reads it: each slot with the run that filled
 * it (app-computed — ground truth), runs that filled nothing, and the
 * cross-training around them.
 */
export function weekForPrompt(week: SeasonWeekLike) {
  return {
    weekStart: week.weekStart,
    status: week.plan ? week.plan.status : "not planned yet",
    note: week.plan?.note,
    slots: week.slots.map((s) => {
      const fill = week.fills[s.id];
      return {
        id: s.id,
        kind: s.kind,
        type: s.type,
        title: s.title,
        description: s.description,
        targetDistance: s.targetDistance,
        targetPace: s.targetPace,
        intervals: s.intervals,
        optional: s.optional || undefined,
        skipped: s.skipped || undefined,
        pinned: s.pinnedWorkoutId ? true : undefined,
        filledBy: fill ? runForPrompt(fill) : null,
      };
    }),
    extraRuns: week.extras.map(runForPrompt),
    crossTraining: week.crossTraining.map((c) => (c.actualDistance ? `${c.title} ${c.actualDistance} km` : c.title)),
    totals: week.totals,
  };
}

/** The set_week_slots tool's slot (snake_case, loosely typed) → the stored slot. */
export function slotInputToSlot(input: Record<string, unknown>): Slot {
  const kind = input.kind;
  if (kind !== "quality" && kind !== "long" && kind !== "easy") {
    throw new Error(`Slot kind must be quality, long or easy (got ${String(kind)})`);
  }
  return {
    id: String(input.id),
    kind,
    type: String(input.type),
    title: String(input.title),
    description: String(input.description ?? ""),
    targetDistance: typeof input.target_distance === "number" ? input.target_distance : undefined,
    targetPace: typeof input.target_pace === "string" ? input.target_pace : undefined,
    intervals: Array.isArray(input.intervals) ? (input.intervals as Slot["intervals"]) : undefined,
    optional: input.optional === true,
    skipped: input.skipped === true ? true : undefined,
  };
}
