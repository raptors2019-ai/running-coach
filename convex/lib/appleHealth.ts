import { v, type Infer } from "convex/values";
import { isRunningType, mapStravaTypeToWorkoutType, workoutTitleForType } from "./stravaMapping";

/**
 * Apple Health workouts pushed by an iPhone Shortcut (docs/apple-health-shortcut.md).
 * Shortcuts builds its JSON from text, so every value may arrive as a string
 * with units and thousands separators, and dates arrive in whatever format
 * the Shortcut's date formatting produced. Everything here is pure, so the
 * HTTP endpoint stays a thin wrapper and the parsing is testable.
 */

export const APPLE_ID_PREFIX = "ah:";
export const TIME_ZONE = "America/Toronto";
export const MAX_HR_POINTS = 600;
export const MAX_ROUTE_POINTS = 1000;
export const MAX_LAPS = 200;
export const MAX_RAW_CHARS = 8000;
const MAX_TEXT_CHARS = 300;

export function isAppleId(activityId: string | undefined): boolean {
  return activityId?.startsWith(APPLE_ID_PREFIX) ?? false;
}

/** Whether a mapped/stored workout type is a run ("run" is the sync's raw run type). */
export function isRunActivity(type: string): boolean {
  return type === "run" || isRunningType(type);
}

// ---------- Auth ----------

/**
 * Constant-time comparison of the X-Ingest-Secret header against the
 * configured secret. Runs in the default Convex runtime (no node:crypto), so
 * it compares byte by byte without an early exit. An unset or empty expected
 * secret never matches.
 */
export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected) return false;
  const a = new TextEncoder().encode(provided ?? "");
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i];
  }
  return diff === 0;
}

// ---------- Value coercion ----------

function normalizeSpaces(s: string): string {
  // iOS puts narrow/no-break spaces in formatted numbers and before AM/PM.
  return s.replace(/[   ]/g, " ").trim();
}

/**
 * A finite number from a number or a string like "1,234 kcal", "5.2 km",
 * "145 bpm". Commas are thousands separators ("1,234"), unless the string
 * has a lone comma that can only be a decimal comma ("5,2").
 */
export function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = normalizeSpaces(value).replace(/ /g, "").match(/-?[\d.,]*\d/);
  if (!match) return undefined;
  let token = match[0];
  if (token.includes(",") && !token.includes(".") && !/^-?\d{1,3}(,\d{3})+$/.test(token)) {
    token = token.replace(",", ".");
  }
  const n = Number(token.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function unitOf(value: unknown): string {
  return typeof value === "string" ? normalizeSpaces(value).replace(/^[-\d.,\s]+/, "").toLowerCase() : "";
}

/** Kilometres from km (default), "mi", or "m". */
export function coerceDistanceKm(value: unknown): number | undefined {
  const n = coerceNumber(value);
  if (n === undefined) return undefined;
  const unit = unitOf(value);
  if (/^(mi|mile)/.test(unit)) return n * 1.609344;
  if (/^(m|meter|metre)s?$/.test(unit)) return n / 1000;
  return n;
}

/** Seconds from a number (seconds), "h:mm:ss" / "mm:ss", or "1 hr, 5 min" / "45 min" / "90 s". */
export function coerceDurationSeconds(value: unknown): number | undefined {
  if (typeof value === "string") {
    const s = normalizeSpaces(value).toLowerCase();
    const clock = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (clock) {
      const [, a, b, c] = clock;
      return c !== undefined ? +a * 3600 + +b * 60 + +c : +a * 60 + +b;
    }
    const parts = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g)];
    if (parts.length > 0) {
      return parts.reduce((sum, [, n, unit]) => sum + +n * (unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1), 0);
    }
  }
  return coerceNumber(value);
}

/** Kilocalories from kcal / Cal (default) or kJ. */
export function coerceKcal(value: unknown): number | undefined {
  const n = coerceNumber(value);
  if (n === undefined) return undefined;
  return /^kj/.test(unitOf(value)) ? n / 4.184 : n;
}

export function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase();
  if (["true", "yes", "1", "indoor", "on"].includes(s)) return true;
  if (["false", "no", "0", "outdoor", "off"].includes(s)) return false;
  return undefined;
}

/** A short display string; objects (Shortcuts weather, location) become JSON. */
function coerceText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = typeof value === "string" ? normalizeSpaces(value) : JSON.stringify(value);
  return s ? s.slice(0, MAX_TEXT_CHARS) : undefined;
}

// ---------- Dates ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const ZONE_OFFSETS_MIN: Record<string, number> = {
  utc: 0, gmt: 0, z: 0, edt: -240, est: -300, cdt: -300, cst: -360, mdt: -360, mst: -420, pdt: -420, pst: -480,
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallClockParts(ms: number) {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return parts;
}

/** Toronto local wall-clock time for an instant: "YYYY-MM-DDTHH:MM:SS". */
export function torontoLocalTime(ms: number): string {
  const p = wallClockParts(ms);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** The instant a Toronto wall-clock time names (DST-aware). */
export function torontoWallClockToMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetAt = (ms: number) => {
    const p = wallClockParts(ms);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  let ms = asUtc - offsetAt(asUtc);
  ms = asUtc - offsetAt(ms); // second pass settles times near a DST switch
  return ms;
}

function offsetMinutes(zone: string | undefined): number | undefined {
  if (!zone) return undefined;
  const z = zone.trim().toLowerCase();
  if (z in ZONE_OFFSETS_MIN) return ZONE_OFFSETS_MIN[z];
  const m = z.match(/^(?:gmt|utc)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return undefined;
  const mins = +m[2] * 60 + (m[3] ? +m[3] : 0);
  return m[1] === "-" ? -mins : mins;
}

function buildInstant(
  y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string | undefined
): number | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return undefined;
  const offset = offsetMinutes(zone);
  if (offset !== undefined) return Date.UTC(y, mo - 1, d, h, mi, s) - offset * 60_000;
  // No (recognised) zone: the athlete's phone is on Toronto time.
  return torontoWallClockToMs(y, mo, d, h, mi, s);
}

function to24h(hour: number, ampm: string | undefined): number {
  if (!ampm) return hour;
  const pm = ampm.toLowerCase().startsWith("p");
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

/**
 * Epoch milliseconds from an ISO 8601 string, epoch seconds/milliseconds, or
 * a Shortcuts-style date ("Oct 31, 2026 at 7:05 AM", "31 Oct 2026 at 19:05",
 * "2026-10-31 07:05:12 -0400"). Strings without a zone are Toronto time.
 */
export function parseDateMs(value: unknown): number | undefined {
  if (typeof value === "number" || (typeof value === "string" && /^\d{9,13}(\.\d+)?$/.test(value.trim()))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n < 1e11 ? Math.round(n * 1000) : Math.round(n);
  }
  if (typeof value !== "string") return undefined;
  const s = normalizeSpaces(value).replace(/\s+/g, " ");

  // ISO-ish: 2026-10-31T07:05:12.000-04:00, 2026-10-31 07:05 -0400, 2026/10/31 7:05
  const iso = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)? ?([AaPp][Mm])? ?(Z|[A-Za-z]{2,4}(?:[+-]\d{1,2}(?::?\d{2})?)?|[+-]\d{2}:?\d{2})?$/
  );
  if (iso) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0", ampm, zone] = iso;
    return buildInstant(+y, +mo, +d, to24h(+h, ampm), +mi, +sec, zone);
  }

  // Month-first: "Oct 31, 2026 at 7:05 AM", "October 31, 2026, 7:05:12 PM EDT"
  // Day-first: "31 Oct 2026 at 19:05"
  const time = String.raw`(?:,? (?:at )?(\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp]\.?[Mm]\.?)?)?(?: ([A-Za-z]{2,4}(?:[+-]\d{1,2}(?::?\d{2})?)?|[+-]\d{2}:?\d{2}))?$`;
  const monthFirst = s.match(new RegExp(String.raw`^(?:[A-Za-z]+,? )?([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})` + time));
  const dayFirst = s.match(new RegExp(String.raw`^(?:[A-Za-z]+,? )?(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})` + time));
  const named = monthFirst
    ? { mon: monthFirst[1], day: monthFirst[2], rest: monthFirst.slice(3) }
    : dayFirst
      ? { mon: dayFirst[2], day: dayFirst[1], rest: dayFirst.slice(3) }
      : null;
  if (named) {
    const mo = MONTHS[named.mon.toLowerCase().slice(0, 3)];
    if (!mo) return undefined;
    const [y, h = "0", mi = "0", sec = "0", ampm, zone] = named.rest;
    return buildInstant(+y, mo, +named.day, to24h(+h, ampm?.replace(/\./g, "")), +mi, +sec, zone);
  }
  return undefined;
}

// ---------- Workout types ----------

function normalizeType(appleType: string): string {
  return appleType
    .replace(/^HKWorkoutActivityType/i, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const APPLE_TO_STRAVA: Record<string, string> = {
  running: "Run",
  outdoorrun: "Run",
  indoorrun: "Run",
  trailrunning: "TrailRun",
  walking: "Walk",
  outdoorwalk: "Walk",
  indoorwalk: "Walk",
  hiking: "Hike",
  cycling: "Ride",
  outdoorcycle: "Ride",
  indoorcycle: "VirtualRide",
  handcycling: "Handcycle",
  swimming: "Swim",
  poolswim: "Swim",
  openwaterswim: "Swim",
  traditionalstrengthtraining: "WeightTraining",
  functionalstrengthtraining: "WeightTraining",
  strengthtraining: "WeightTraining",
  coretraining: "Workout",
  yoga: "Yoga",
  pilates: "Pilates",
  mindandbody: "Yoga",
  highintensityintervaltraining: "HighIntensityIntervalTraining",
  hiit: "HighIntensityIntervalTraining",
  crosstraining: "Crossfit",
  mixedcardio: "Workout",
  elliptical: "Elliptical",
  stairclimbing: "StairStepper",
  stairs: "StairStepper",
  steptraining: "StairStepper",
  rowing: "Rowing",
  basketball: "Workout",
};

/**
 * The Strava activity type an Apple Health workout type corresponds to, so
 * Apple workouts land in the same app types as Strava's did. Apple types
 * Strava has no name for become "Workout" — the type Strava gave basketball
 * and other watch workouts, which the app maps to cross_training.
 */
export function mapAppleType(appleType: string): string {
  const t = normalizeType(appleType);
  if (APPLE_TO_STRAVA[t]) return APPLE_TO_STRAVA[t];
  if (/run/.test(t)) return "Run";
  if (/walk/.test(t)) return "Walk";
  if (/cycl|bike|biking|ride/.test(t)) return "Ride";
  if (/swim/.test(t)) return "Swim";
  if (/strength|weight|lift/.test(t)) return "WeightTraining";
  if (/yoga/.test(t)) return "Yoga";
  if (/hik/.test(t)) return "Hike";
  return "Workout";
}

/** The app's workout type for an Apple Health workout. */
export function mapAppleWorkoutType(appleType: string, activityName: string): string {
  return mapStravaTypeToWorkoutType(mapAppleType(appleType), activityName);
}

// Strava's names for the common ones ("Morning Run", not "Morning Running").
const SHORT_LABELS: Record<string, string> = { running: "Run", walking: "Walk", cycling: "Ride", swimming: "Swim", hiking: "Hike" };

/** "traditionalStrengthTraining" / "HKWorkoutActivityTypeBasketball" -> readable words. */
function appleTypeLabel(appleType: string): string {
  const short = SHORT_LABELS[normalizeType(appleType)];
  if (short) return short;
  const words = appleType
    .replace(/^HKWorkoutActivityType/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words.replace(/\b\w/g, (c) => c.toUpperCase()) || "Workout";
}

/**
 * Strava-style name ("Evening Weight Training", "Night Basketball") from
 * the local start hour. The app reads activity names from the description,
 * e.g. the season page's cross-training chips.
 */
export function activityNameFor(appleType: string, localStartTime: string): string {
  const hour = Number(localStartTime.slice(11, 13));
  const part =
    hour < 4 ? "Night" : hour < 11 ? "Morning" : hour < 14 ? "Lunch" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
  return `${part} ${appleTypeLabel(appleType)}`;
}

// ---------- Series ----------

/** Evenly bucket-average a time-ordered series down to at most `max` points. */
export function downsample(points: number[][], max: number): number[][] {
  if (points.length <= max) return points;
  const out: number[][] = [];
  const size = points.length / max;
  for (let i = 0; i < max; i++) {
    const bucket = points.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    if (bucket.length === 0) continue;
    const width = bucket[0].length;
    const avg: number[] = [];
    for (let k = 0; k < width; k++) avg.push(bucket.reduce((sum, p) => sum + p[k], 0) / bucket.length);
    out.push(avg);
  }
  return out;
}

function asArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Heart-rate samples as [secondsFromStart, bpm], sorted and downsampled.
 * Each sample may be [t, bpm] or {t|time|date, bpm|value}; t is seconds from
 * the start, or a date/epoch that's converted relative to it.
 */
export function parseHrSeries(value: unknown, startMs: number): number[][] {
  const items = asArray(value) ?? [];
  const points: number[][] = [];
  for (const item of items) {
    let rawT: unknown;
    let rawBpm: unknown;
    if (Array.isArray(item)) [rawT, rawBpm] = item;
    else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      rawT = o.t ?? o.time ?? o.date ?? o.start;
      rawBpm = o.bpm ?? o.value ?? o.hr;
    } else continue;
    const bpm = coerceNumber(rawBpm);
    if (bpm === undefined || bpm < 20 || bpm > 250) continue;
    // A small plain number is an offset in seconds; anything else is a date or epoch.
    let t =
      typeof rawT === "number" ? rawT : typeof rawT === "string" && /^-?\d+(\.\d+)?$/.test(rawT.trim()) ? +rawT : undefined;
    if (t !== undefined && Math.abs(t) > 1e8) t = undefined;
    if (t === undefined) {
      const ms = parseDateMs(rawT);
      if (ms === undefined) continue;
      t = (ms - startMs) / 1000;
    }
    points.push([t, bpm]);
  }
  points.sort((a, b) => a[0] - b[0]);
  return downsample(points, MAX_HR_POINTS).map(([t, bpm]) => [Math.round(t), Math.round(bpm)]);
}

/** Route as [lat, lng] or [lat, lng, elevationM], downsampled. */
export function parseRoute(value: unknown): number[][] {
  const items = asArray(value) ?? [];
  const points: number[][] = [];
  for (const item of items) {
    const o: Record<string, unknown> | null = Array.isArray(item)
      ? { lat: item[0], lng: item[1], ele: item[2] }
      : item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : null;
    if (!o) continue;
    const lat = coerceNumber(o.lat ?? o.latitude);
    const lng = coerceNumber(o.lng ?? o.lon ?? o.longitude);
    if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const ele = coerceNumber(o.ele ?? o.elevation ?? o.altitude);
    points.push(ele === undefined ? [lat, lng] : [lat, lng, ele]);
  }
  // Downsample by picking points, not averaging — an averaged corner cuts the road.
  if (points.length <= MAX_ROUTE_POINTS) return points;
  const step = (points.length - 1) / (MAX_ROUTE_POINTS - 1);
  return Array.from({ length: MAX_ROUTE_POINTS }, (_, i) => points[Math.round(i * step)]);
}

export const lapValidator = v.object({
  label: v.optional(v.string()),
  startS: v.optional(v.number()), // seconds from workout start
  durationS: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  avgHR: v.optional(v.number()),
  maxHR: v.optional(v.number()),
});
export type Lap = Infer<typeof lapValidator>;

export function parseLaps(value: unknown, startMs: number): Lap[] {
  const items = asArray(value) ?? [];
  const laps: Lap[] = [];
  for (const item of items.slice(0, MAX_LAPS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    let startS = coerceNumber(o.startS);
    if (startS === undefined && o.start !== undefined) {
      const ms = parseDateMs(o.start);
      if (ms !== undefined) startS = Math.round((ms - startMs) / 1000);
    }
    const lap: Lap = {
      label: coerceText(o.label ?? o.name),
      startS,
      durationS: coerceDurationSeconds(o.durationS ?? o.duration),
      distanceKm: coerceDistanceKm(o.distanceKm ?? o.distance),
      avgHR: coerceNumber(o.avgHR),
      maxHR: coerceNumber(o.maxHR),
    };
    const clean = Object.fromEntries(Object.entries(lap).filter(([, x]) => x !== undefined)) as Lap;
    if (Object.keys(clean).length > 0) laps.push(clean);
  }
  return laps;
}

// ---------- Payload ----------

/** What gets stored per Apple Health workout (the activityDetails row, minus links). */
export const appleWorkoutFields = {
  activityId: v.string(), // "ah:" + the Shortcut's id
  appleType: v.string(),
  name: v.string(),
  date: v.string(), // YYYY-MM-DD, Toronto
  startTime: v.string(), // Toronto wall clock, YYYY-MM-DDTHH:MM:SS
  startMs: v.number(),
  endMs: v.number(),
  durationS: v.number(),
  distanceKm: v.optional(v.number()),
  avgHR: v.optional(v.number()),
  maxHR: v.optional(v.number()),
  minHR: v.optional(v.number()),
  activeEnergyKcal: v.optional(v.number()),
  totalEnergyKcal: v.optional(v.number()),
  steps: v.optional(v.number()),
  elevationGainM: v.optional(v.number()),
  avgCadence: v.optional(v.number()),
  avgPowerW: v.optional(v.number()),
  mets: v.optional(v.number()),
  indoor: v.optional(v.boolean()),
  location: v.optional(v.string()),
  weather: v.optional(v.string()),
  device: v.optional(v.string()),
  hr: v.optional(v.array(v.array(v.number()))), // [secondsFromStart, bpm]
  laps: v.optional(v.array(lapValidator)),
  route: v.optional(v.array(v.array(v.number()))), // [lat, lng(, elevationM)]
  raw: v.optional(v.string()), // unrecognised payload fields, JSON, size-capped
};
export const appleWorkoutValidator = v.object(appleWorkoutFields);
export type AppleWorkout = Infer<typeof appleWorkoutValidator>;

const KNOWN_KEYS = new Set([
  "id", "type", "name", "start", "end", "durationS", "distanceKm",
  "avgHR", "maxHR", "minHR", "hr", "activeEnergyKcal", "totalEnergyKcal", "steps", "elevationGainM",
  "avgCadence", "avgPowerW", "mets", "indoor", "location", "weather", "device", "source",
  "laps", "segments", "route",
]);

/** Unknown fields as JSON, adding whole fields while they fit under the cap. */
export function rawExtras(body: Record<string, unknown>): string | undefined {
  const kept: Record<string, unknown> = {};
  const dropped: string[] = [];
  let size = 2;
  for (const [key, value] of Object.entries(body)) {
    if (KNOWN_KEYS.has(key)) continue;
    const entry = JSON.stringify({ [key]: value }).length;
    if (size + entry + 40 > MAX_RAW_CHARS) {
      dropped.push(key.slice(0, 40));
      continue;
    }
    kept[key] = value;
    size += entry;
  }
  if (dropped.length > 0) {
    const withDropped = { ...kept, _dropped: dropped };
    const json = JSON.stringify(withDropped);
    return json.length <= MAX_RAW_CHARS ? json : JSON.stringify({ ...kept, _dropped: dropped.length });
  }
  return Object.keys(kept).length > 0 ? JSON.stringify(kept) : undefined;
}

const round = (n: number | undefined, places = 0) =>
  n === undefined ? undefined : Math.round(n * 10 ** places) / 10 ** places;
const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

export type ParseResult = { ok: true; workout: AppleWorkout } | { ok: false; error: string };

/**
 * Validate and normalise one workout payload. Lenient about formats, strict
 * only about what a workouts row can't exist without: an id, a type, a start
 * and a positive duration. Error messages name fields, never echo values.
 */
export function parseAppleWorkout(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;

  const id = typeof b.id === "number" ? String(b.id) : typeof b.id === "string" ? normalizeSpaces(b.id) : "";
  if (!id || id.length > 200) return { ok: false, error: "id is required (1-200 chars)" };
  const appleType = typeof b.type === "string" ? normalizeSpaces(b.type).slice(0, 100) : "";
  if (!appleType) return { ok: false, error: "type is required" };

  const startMs = parseDateMs(b.start);
  if (startMs === undefined) return { ok: false, error: "start is missing or not a recognised date" };
  const endParsed = parseDateMs(b.end);
  let durationS = positive(coerceDurationSeconds(b.durationS));
  if (durationS === undefined && endParsed !== undefined && endParsed > startMs) {
    durationS = (endParsed - startMs) / 1000;
  }
  if (durationS === undefined) return { ok: false, error: "durationS or a valid end is required" };
  if (durationS > 2 * 86400) return { ok: false, error: "durationS is longer than two days" };
  durationS = Math.round(durationS);
  const endMs = endParsed !== undefined && endParsed > startMs ? endParsed : startMs + durationS * 1000;

  const startTime = torontoLocalTime(startMs);
  const hr = parseHrSeries(b.hr, startMs);
  const bpms = hr.map((p) => p[1]);
  const laps = parseLaps(b.laps ?? b.segments, startMs);
  const route = parseRoute(b.route);
  const name = coerceText(b.name) ?? activityNameFor(appleType, startTime);

  const workout: AppleWorkout = {
    activityId: APPLE_ID_PREFIX + id,
    appleType,
    name: name.slice(0, 120),
    date: startTime.slice(0, 10),
    startTime,
    startMs,
    endMs,
    durationS,
    distanceKm: round(positive(coerceDistanceKm(b.distanceKm)), 2),
    avgHR: round(positive(coerceNumber(b.avgHR))) ?? (bpms.length ? Math.round(bpms.reduce((s, x) => s + x, 0) / bpms.length) : undefined),
    maxHR: round(positive(coerceNumber(b.maxHR))) ?? (bpms.length ? Math.max(...bpms) : undefined),
    minHR: round(positive(coerceNumber(b.minHR))) ?? (bpms.length ? Math.min(...bpms) : undefined),
    activeEnergyKcal: round(positive(coerceKcal(b.activeEnergyKcal))),
    totalEnergyKcal: round(positive(coerceKcal(b.totalEnergyKcal))),
    steps: round(positive(coerceNumber(b.steps))),
    elevationGainM: round(positive(coerceNumber(b.elevationGainM)), 1),
    avgCadence: round(positive(coerceNumber(b.avgCadence))),
    avgPowerW: round(positive(coerceNumber(b.avgPowerW))),
    mets: round(positive(coerceNumber(b.mets)), 1),
    indoor: coerceBoolean(b.indoor),
    location: coerceText(b.location),
    weather: coerceText(b.weather),
    device: coerceText(b.device ?? b.source),
    hr: hr.length ? hr : undefined,
    laps: laps.length ? laps : undefined,
    route: route.length ? route : undefined,
    raw: rawExtras(b),
  };
  // Keep the stored document free of undefined fields.
  return { ok: true, workout: Object.fromEntries(Object.entries(workout).filter(([, x]) => x !== undefined)) as AppleWorkout };
}

/** The shape autoCompleteFromActivities takes, same as a mapped Strava activity. */
export function toSyncedActivity(w: Pick<AppleWorkout, "activityId" | "appleType" | "name" | "date" | "startTime" | "durationS" | "distanceKm" | "avgHR">) {
  const mappedType = mapAppleWorkoutType(w.appleType, w.name);
  return {
    date: w.date,
    startTime: w.startTime,
    stravaActivityId: w.activityId,
    actualDistance: w.distanceKm ?? 0,
    actualDuration: w.durationS,
    avgHeartRate: w.avgHR,
    mappedType,
    mappedTitle: workoutTitleForType(mappedType),
    activityName: w.name,
  };
}

// ---------- Coach prompt ----------

const HR_BANDS: [string, number][] = [["<120", 120], ["120-139", 140], ["140-159", 160], ["160-174", 175], ["175+", Infinity]];

/**
 * Minutes in each heart-rate band, weighting each sample by the gap to the
 * next one (capped at a minute, so a gap in the recording doesn't count).
 */
export function minutesInHrBands(hr: number[][], durationS: number): Record<string, number> | undefined {
  if (hr.length < 2) return undefined;
  const seconds = new Map<string, number>();
  for (let i = 0; i < hr.length; i++) {
    const next = i + 1 < hr.length ? hr[i + 1][0] : durationS;
    const dt = Math.min(Math.max(next - hr[i][0], 0), 60);
    const band = HR_BANDS.find(([, upper]) => hr[i][1] < upper)![0];
    seconds.set(band, (seconds.get(band) ?? 0) + dt);
  }
  const out: Record<string, number> = {};
  for (const [band] of HR_BANDS) {
    const mins = Math.round((seconds.get(band) ?? 0) / 60);
    if (mins > 0) out[band] = mins;
  }
  return out;
}

/** Average bpm per quarter of the workout, showing drift and where the work was. */
export function hrByQuarter(hr: number[][], durationS: number): number[] | undefined {
  if (hr.length < 4 || durationS <= 0) return undefined;
  const sums = [0, 0, 0, 0];
  const counts = [0, 0, 0, 0];
  for (const [t, bpm] of hr) {
    const q = Math.min(3, Math.max(0, Math.floor((t / durationS) * 4)));
    sums[q] += bpm;
    counts[q]++;
  }
  return counts.every((c) => c > 0) ? sums.map((s, i) => Math.round(s / counts[i])) : undefined;
}

/** The compact slice of an Apple Health detail row the coach sees on a workout. */
export function detailForPrompt(d: AppleWorkout) {
  const out = {
    source: "Apple Health",
    appleType: d.appleType,
    start: d.startTime.slice(11, 16),
    durationMin: Math.round(d.durationS / 60),
    avgHR: d.avgHR,
    maxHR: d.maxHR,
    minHR: d.minHR,
    activeKcal: d.activeEnergyKcal,
    totalKcal: d.totalEnergyKcal,
    hrMinutesByBand: d.hr ? minutesInHrBands(d.hr, d.durationS) : undefined,
    hrByQuarter: d.hr ? hrByQuarter(d.hr, d.durationS) : undefined,
    elevationGainM: d.elevationGainM,
    avgCadence: d.avgCadence,
    avgPowerW: d.avgPowerW,
    steps: d.steps,
    mets: d.mets,
    indoor: d.indoor,
    laps: d.laps?.length,
  };
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined));
}

// ---------- Dedupe against Strava ----------

export const DUPLICATE_WINDOW_MIN = 5;

/** Minutes between two local wall-clock strings ("YYYY-MM-DDTHH:MM:SS", any trailing Z ignored). */
export function wallClockMinutesApart(a: string, b: string): number | undefined {
  const parse = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) : undefined;
  };
  const x = parse(a);
  const y = parse(b);
  return x === undefined || y === undefined ? undefined : Math.abs(x - y) / 60_000;
}

export type DedupeCandidate = { startTime?: string; durationS: number; isRun: boolean };

/**
 * Whether two recordings are the same workout. With both start times known
 * (Strava's start_date_local is wall-clock time, like ours), it's a start
 * within 5 minutes. Strava-synced workouts rows don't store a start time, so
 * when one is missing the fallback is same kind (run vs not) and durations
 * within max(5 min, 10%) — Strava reports moving time, Apple elapsed time.
 */
export function isSameActivity(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (a.startTime && b.startTime) {
    const apart = wallClockMinutesApart(a.startTime, b.startTime);
    if (apart !== undefined) return apart <= DUPLICATE_WINDOW_MIN;
  }
  if (a.isRun !== b.isRun) return false;
  return Math.abs(a.durationS - b.durationS) <= Math.max(DUPLICATE_WINDOW_MIN * 60, 0.1 * Math.max(a.durationS, b.durationS));
}
