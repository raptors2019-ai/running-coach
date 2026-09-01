/** Get today's date as YYYY-MM-DD in local timezone */
export function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Convert a pace string to total seconds per km. Tolerates the "/km" unit
 * suffix that Strava-synced workouts carry ("7:17/km") as well as the plain
 * "7:17" form used by manual entries. Returns NaN when no M:SS token exists.
 */
export function paceToSeconds(pace: string): number {
  const m = /(\d+):(\d{2})/.exec(pace ?? "");
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Render a stored pace ("7:17" or "7:17/km") with exactly one "/km" unit. */
export function formatPaceDisplay(pace: string): string {
  const seconds = paceToSeconds(pace);
  if (Number.isNaN(seconds)) return pace;
  return `${secondsToPace(seconds)}/km`;
}

/** Convert total seconds to "M:SS" pace string */
export function secondsToPace(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60);
  const sec = Math.round(totalSeconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** Convert duration in seconds to "H:MM:SS" or "MM:SS" */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Calculate pace from distance (km) and duration (seconds) */
export function calculatePace(distanceKm: number, durationSeconds: number): string {
  if (distanceKm <= 0) return "0:00";
  const paceSeconds = durationSeconds / distanceKm;
  return secondsToPace(paceSeconds);
}

/**
 * Riegel formula for predicting race time from a known performance.
 * predictedTime = knownTime * (targetDistance / knownDistance) ^ 1.06
 */
export function riegelPrediction(
  knownDistanceKm: number,
  knownTimeSeconds: number,
  targetDistanceKm: number
): number {
  return knownTimeSeconds * Math.pow(targetDistanceKm / knownDistanceKm, 1.06);
}

/** Predict race time from a recent run */
export function predictRaceTime(
  distanceKm: number,
  durationSeconds: number,
  raceDistanceKm: number
): {
  predictedSeconds: number;
  predictedPace: string;
  formattedTime: string;
} {
  const predictedSeconds = riegelPrediction(distanceKm, durationSeconds, raceDistanceKm);
  return {
    predictedSeconds,
    predictedPace: calculatePace(raceDistanceKm, predictedSeconds),
    formattedTime: formatDuration(predictedSeconds),
  };
}

/** Calculate days between two dates */
export function daysUntil(targetDate: string): number {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Format distance with appropriate precision */
export function formatDistance(km: number): string {
  if (km === Math.floor(km)) return `${km} km`;
  return `${km.toFixed(1)} km`;
}
