export type Point = [number, number];

/** The hero's trail, in its 354×150 viewBox: base camp to the 10K summit to the 5K summit. */
export const TRAIL = {
  points: [
    [22, 138], [70, 130], [130, 106], [168, 80], [190, 70], [240, 60], [262, 46], [300, 30], [318, 22],
  ] as Point[],
  tenKSummit: [190, 70] as Point,
  fiveKSummit: [318, 22] as Point,
};

/** The point a fraction of the way along a polyline, measured by length. */
export function pointAlong(points: Point[], fraction: number): Point {
  const f = Math.min(1, Math.max(0, fraction));
  const segs = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let left = f * segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : Math.min(1, left / segs[i]);
      const [a, b] = [points[i], points[i + 1]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    left -= segs[i];
  }
  return points[0];
}

function lengthTo(points: Point[], index: number): number {
  let total = 0;
  for (let i = 1; i <= index; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

/**
 * Where on the trail a point in the season sits. The trail is drawn with
 * the 10K summit partway up, so time is mapped piecewise: base camp → 10K
 * summit by the 10K goal date, then on to the 5K summit by season's end.
 */
export function trailFraction(progress: number, tenKGoalProgress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const summitIdx = TRAIL.points.findIndex(([x, y]) => x === TRAIL.tenKSummit[0] && y === TRAIL.tenKSummit[1]);
  const atSummit = lengthTo(TRAIL.points, summitIdx) / lengthTo(TRAIL.points, TRAIL.points.length - 1);
  if (tenKGoalProgress <= 0 || tenKGoalProgress >= 1) return p;
  return p <= tenKGoalProgress
    ? (p / tenKGoalProgress) * atSummit
    : atSummit + ((p - tenKGoalProgress) / (1 - tenKGoalProgress)) * (1 - atSummit);
}
