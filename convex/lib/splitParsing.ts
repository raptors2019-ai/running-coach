/**
 * Turning a watch's split/segment screenshot into numbers.
 *
 * The model transcribes what it can see; everything derived (pace, totals,
 * rep grouping) is computed here so the coach can never quote a hallucinated
 * pace. The transcription is cross-checked against the pace the screenshot
 * itself displays — a disagreement means the OCR misread a digit, which is
 * exactly the failure worth surfacing rather than burying.
 */

import { v, type Infer } from "convex/values";

export const SPLIT_KINDS = ["warmup", "work", "recovery", "steady", "cooldown", "unknown"] as const;
export type SplitKind = (typeof SPLIT_KINDS)[number];

/** The stored shape of a split. Shared by the schema and the write mutation. */
export const splitValidator = v.object({
  index: v.number(),
  distanceMeters: v.number(),
  durationSeconds: v.number(),
  paceSecondsPerKm: v.number(), // derived here, never transcribed
  displayedPace: v.optional(v.string()), // as printed, kept for cross-check
  heartRate: v.optional(v.number()),
  kind: v.union(
    v.literal("warmup"),
    v.literal("work"),
    v.literal("recovery"),
    v.literal("steady"),
    v.literal("cooldown"),
    v.literal("unknown")
  ),
  paceMismatch: v.optional(v.boolean()),
});

const METERS_PER_MILE = 1609.344;

/** One row exactly as the model transcribed it, before any derivation. */
export type RawSplit = {
  index?: number;
  distance_meters?: number;
  duration_seconds?: number;
  displayed_pace?: string;
  heart_rate?: number;
  kind?: string;
};

/**
 * Derived from the validator rather than written twice, so the stored shape
 * and the type can't drift apart. `paceMismatch` means the screenshot's own
 * pace disagrees with distance ÷ time — suspect OCR.
 */
export type Split = Infer<typeof splitValidator>;

/**
 * Pace strings arrive in whatever the watch renders: 7'23"/km, 4:31 /km,
 * 7:23/mi. Returns seconds per kilometre, converting from miles when the
 * string says so. Null when there is no M:SS token to read.
 */
export function parseDisplayedPace(text: string | undefined): number | null {
  if (!text) return null;
  const m = /(\d{1,3})\s*[:'′]\s*(\d{2})/.exec(text);
  if (!m) return null;
  const seconds = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (seconds <= 0) return null;
  const perMile = /\/\s*(mi|mile)/i.test(text);
  return perMile ? (seconds * 1000) / METERS_PER_MILE : seconds;
}

export function paceSecondsPerKm(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0) return 0;
  return (durationSeconds * 1000) / distanceMeters;
}

/**
 * How far the computed pace may sit from the displayed one before we call it
 * a misread. Watches round distance to the metre, so a 121 m segment carries
 * up to ~4 s/km of honest rounding error — the tolerance scales with the pace
 * rather than sitting at a flat threshold that would flag every short jog.
 */
function paceTolerance(computedSecondsPerKm: number): number {
  return Math.max(5, computedSecondsPerKm * 0.02);
}

function toKind(value: string | undefined): SplitKind {
  const normalized = (value ?? "").trim().toLowerCase();
  return (SPLIT_KINDS as readonly string[]).includes(normalized)
    ? (normalized as SplitKind)
    : "unknown";
}

/**
 * Drop rows the model couldn't read a distance or time for (a value invented
 * to fill a gap is worse than a missing row), then derive pace and renumber
 * so the list reads 1..n even if a row was dropped.
 */
export function normalizeSplits(raw: RawSplit[]): Split[] {
  const splits: Split[] = [];
  for (const row of raw ?? []) {
    const distanceMeters = Number(row?.distance_meters);
    const durationSeconds = Number(row?.duration_seconds);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) continue;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) continue;

    const pace = paceSecondsPerKm(distanceMeters, durationSeconds);
    const displayed = parseDisplayedPace(row.displayed_pace);
    const heartRate = Number(row?.heart_rate);

    splits.push({
      index: splits.length + 1,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(durationSeconds),
      paceSecondsPerKm: Math.round(pace),
      displayedPace: row.displayed_pace?.trim() || undefined,
      heartRate: Number.isFinite(heartRate) && heartRate > 0 ? Math.round(heartRate) : undefined,
      kind: toKind(row.kind),
      paceMismatch:
        displayed !== null && Math.abs(displayed - pace) > paceTolerance(pace) ? true : undefined,
    });
  }
  return splits;
}

export type SplitsSummary = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  avgPaceSecondsPerKm: number;
};

export function summarizeSplits(splits: Split[]): SplitsSummary {
  const totalDistanceMeters = splits.reduce((sum, s) => sum + s.distanceMeters, 0);
  const totalDurationSeconds = splits.reduce((sum, s) => sum + s.durationSeconds, 0);
  return {
    totalDistanceMeters,
    totalDurationSeconds,
    avgPaceSecondsPerKm: Math.round(paceSecondsPerKm(totalDistanceMeters, totalDurationSeconds)),
  };
}

// ---------- formatting ----------

export function formatClock(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, "0")}`
    : `${mm}:${String(seconds).padStart(2, "0")}`;
}

export function formatPace(secondsPerKm: number): string {
  return `${formatClock(secondsPerKm)}/km`;
}

export function formatSplitDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** One split as a single line — the form the coach reads in its context. */
export function splitLine(s: Split): string {
  const parts = [
    `${s.index}.`,
    formatSplitDistance(s.distanceMeters),
    `in ${formatClock(s.durationSeconds)}`,
    `(${formatPace(s.paceSecondsPerKm)}`,
  ];
  const extras = [
    s.heartRate ? `${s.heartRate} bpm` : null,
    s.kind !== "unknown" ? s.kind : null,
    s.paceMismatch ? "PACE DISAGREES WITH SCREENSHOT — possible misread" : null,
  ].filter(Boolean);
  return `${parts.join(" ")}${extras.length ? `, ${extras.join(", ")}` : ""})`;
}

/**
 * The work reps on one line — the thing that actually gets judged in an
 * interval session, where the session average pace means nothing.
 */
export function workRepsSummary(splits: Split[]): string | null {
  const work = splits.filter((s) => s.kind === "work");
  if (work.length === 0) return null;
  const distances = new Set(work.map((s) => s.distanceMeters));
  const label =
    distances.size === 1
      ? `${work.length} x ${formatSplitDistance(work[0].distanceMeters)}`
      : `${work.length} work reps`;
  return `${label} @ ${work.map((s) => formatClock(s.paceSecondsPerKm)).join(", ")} /km`;
}

/**
 * The plain-text block the athlete copies or shares with a human coach, and
 * the same text the AI coach reads. One format, so what gets sent to a person
 * is exactly what the app reasoned about.
 */
export function formatSplitsReport(upload: {
  date: string;
  source?: string;
  note?: string;
  splits: Split[];
}): string {
  const summary = summarizeSplits(upload.splits);
  const lines = [
    `Splits — ${upload.date}${upload.source ? ` (${upload.source})` : ""}`,
    `Total ${formatSplitDistance(summary.totalDistanceMeters)} in ${formatClock(
      summary.totalDurationSeconds
    )} — ${formatPace(summary.avgPaceSecondsPerKm)} average`,
  ];
  const reps = workRepsSummary(upload.splits);
  if (reps) lines.push(reps);
  lines.push("");
  lines.push(...upload.splits.map(splitLine));
  if (upload.note) {
    lines.push("");
    lines.push(`Note: ${upload.note}`);
  }
  return lines.join("\n");
}

/**
 * Splits as the coach reads them: one line per split, plus the derived
 * headline numbers. Lines rather than JSON — same information, a third of the
 * prompt, and no chance of the model re-deriving a pace itself.
 */
export function splitsForPrompt(upload: {
  date: string;
  source?: string;
  note?: string;
  splits?: Split[];
  extractionNotes?: string;
}) {
  const splits = upload.splits ?? [];
  const summary = summarizeSplits(splits);
  return {
    date: upload.date,
    source: upload.source,
    athleteNote: upload.note,
    total: `${(summary.totalDistanceMeters / 1000).toFixed(2)} km in ${formatClock(
      summary.totalDurationSeconds
    )} (${formatPace(summary.avgPaceSecondsPerKm)} average)`,
    workReps: workRepsSummary(splits) ?? undefined,
    splits: splits.map(splitLine),
    readerNotes: upload.extractionNotes,
  };
}
