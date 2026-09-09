import { typeAffinityScore, parseTargetPaceSeconds } from "./stravaMapping";

type Row = {
  _id: string;
  type: string;
  targetPace?: string;
  completed: boolean;
  isUnplanned?: boolean;
  stravaActivityId?: string;
};

type Activity = {
  mappedType: string;
  actualDistance: number;
  actualDuration: number;
};

/**
 * A planned row the athlete ticked off by hand ("Quick Complete") with no
 * Strava activity behind it. Its numbers are placeholders, so the next sync
 * is free to replace them with the real run.
 */
export function isPlaceholderCompletion(row: Row): boolean {
  return row.completed && !row.stravaActivityId && !row.isUnplanned;
}

/**
 * The planned row on a date that a fresh Strava activity should complete:
 * an open one if there is one, else a placeholder completion.
 */
export function choosePlannedRow<T extends Row>(rows: T[]): T | undefined {
  return (
    rows.find((w) => !w.isUnplanned && !w.completed && !w.stravaActivityId) ??
    rows.find((w) => isPlaceholderCompletion(w))
  );
}

/**
 * Index of the activity that best fits a planned workout. Type affinity
 * first; ties (a warmup and a time trial are both runs) go to the pace
 * closest to the target, or the longest activity when there is no target.
 */
export function pickBestActivity(planned: Pick<Row, "type" | "targetPace">, activities: Activity[]): number {
  const targetSecs = parseTargetPaceSeconds(planned.targetPace);
  let best = -1;
  let bestScore = -1;
  let bestTiebreak = Infinity;
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const score = typeAffinityScore(planned.type, a.mappedType);
    const paceSecs = a.actualDistance > 0 ? a.actualDuration / a.actualDistance : null;
    let tiebreak: number;
    if (targetSecs !== null) {
      tiebreak = paceSecs !== null ? Math.abs(paceSecs - targetSecs) : Number.MAX_SAFE_INTEGER;
    } else {
      tiebreak = -a.actualDistance;
    }
    if (score > bestScore || (score === bestScore && tiebreak < bestTiebreak)) {
      best = i;
      bestScore = score;
      bestTiebreak = tiebreak;
    }
  }
  return best;
}

type UnplannedRow = Row & {
  actualDistance?: number;
  actualDuration?: number;
  actualPace?: string;
  avgHeartRate?: number;
};

/**
 * When a day holds a placeholder completion and an unplanned Strava row of
 * the same kind, the unplanned row *is* the planned workout — the athlete
 * ticked it off before the sync ran. Returns the patch that moves the real
 * numbers onto the planned row and the unplanned row to remove.
 */
export function adoptUnplannedRun(rows: UnplannedRow[]): {
  plannedId: string;
  unplannedId: string;
  patch: Record<string, unknown>;
} | null {
  const placeholder = rows.find((w) => isPlaceholderCompletion(w));
  if (!placeholder) return null;
  const candidates = rows.filter(
    (w) => w.isUnplanned && w.stravaActivityId && typeAffinityScore(placeholder.type, w.type) > 0
  );
  if (candidates.length === 0) return null;
  const idx = pickBestActivity(
    placeholder,
    candidates.map((w) => ({ mappedType: w.type, actualDistance: w.actualDistance ?? 0, actualDuration: w.actualDuration ?? 0 }))
  );
  const chosen = candidates[idx];
  return {
    plannedId: placeholder._id,
    unplannedId: chosen._id,
    patch: {
      completed: true,
      missedAt: undefined,
      actualDistance: chosen.actualDistance,
      actualDuration: chosen.actualDuration,
      actualPace: chosen.actualPace,
      avgHeartRate: chosen.avgHeartRate,
      stravaActivityId: chosen.stravaActivityId,
    },
  };
}
