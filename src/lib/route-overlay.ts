/**
 * Geometry for the month route overlay: every run of a month drawn on top of
 * each other, Instagram-recap style. Pure functions so the page, the PNG
 * export and the tests all share one layout.
 */

export type LatLng = [number, number];

export interface OverlayRoute {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  distance: number; // km
  duration: number; // seconds
  polyline: string;
}

export type OverlayMode = "map" | "stacked";

export interface OverlayPath {
  id: string;
  name: string;
  date: string;
  distance: number;
  duration: number;
  d: string; // SVG path data in viewBox units
  startX: number;
  startY: number;
}

export interface OverlayLayout {
  width: number;
  height: number;
  paths: OverlayPath[];
  /** Routes left out of "map" mode because they were run somewhere else. */
  away: OverlayRoute[];
}

/** Decode a Google encoded polyline (what Strava's `summary_polyline` is). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

interface XY {
  x: number;
  y: number;
}

/** Equirectangular projection around a reference latitude, in metres. */
function project(points: LatLng[], refLat: number): XY[] {
  const k = Math.cos((refLat * Math.PI) / 180);
  const m = 111_320; // metres per degree
  return points.map(([lat, lng]) => ({ x: lng * k * m, y: -lat * m }));
}

function distanceKm(a: LatLng, b: LatLng): number {
  const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  const dx = (a[1] - b[1]) * k * 111.32;
  const dy = (a[0] - b[0]) * 111.32;
  return Math.hypot(dx, dy);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** How far from home a run can start and still share the map (km). */
const AWAY_RADIUS_KM = 40;

export interface LayoutOptions {
  width: number;
  height: number;
  /** Fraction of the shorter side left clear around the drawing. */
  padding?: number;
  mode?: OverlayMode;
  /** Part of the viewBox the drawing may use (defaults to all of it). */
  area?: { x: number; y: number; width: number; height: number };
}

/**
 * Lay the routes out in a viewBox. "map" keeps real geography (runs that
 * share streets stack up); "stacked" moves every run's start to the same
 * point so shapes compare regardless of where they were run.
 */
export function layoutOverlay(routes: OverlayRoute[], options: LayoutOptions): OverlayLayout {
  const { width, height } = options;
  const padding = options.padding ?? 0.08;
  const mode = options.mode ?? "map";

  const decoded = routes
    .map((route) => ({ route, points: decodePolyline(route.polyline) }))
    .filter((r) => r.points.length >= 2);

  if (decoded.length === 0) {
    return { width, height, paths: [], away: [] };
  }

  let kept = decoded;
  let away: OverlayRoute[] = [];
  if (mode === "map" && decoded.length > 1) {
    const home: LatLng = [
      median(decoded.map((r) => r.points[0][0])),
      median(decoded.map((r) => r.points[0][1])),
    ];
    kept = decoded.filter((r) => distanceKm(r.points[0], home) <= AWAY_RADIUS_KM);
    away = decoded.filter((r) => !kept.includes(r)).map((r) => r.route);
    if (kept.length === 0) {
      kept = decoded;
      away = [];
    }
  }

  const refLat = median(kept.map((r) => r.points[0][0]));
  const projected = kept.map((r) => {
    let xy = project(r.points, refLat);
    if (mode === "stacked") {
      const [origin] = xy;
      xy = xy.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
    }
    return { route: r.route, xy };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { xy } of projected) {
    for (const p of xy) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const area = options.area ?? { x: 0, y: 0, width, height };
  const pad = Math.min(area.width, area.height) * padding;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((area.width - 2 * pad) / spanX, (area.height - 2 * pad) / spanY);
  const offsetX = area.x + (area.width - spanX * scale) / 2;
  const offsetY = area.y + (area.height - spanY * scale) / 2;

  const toView = (p: XY): XY => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  });

  const paths: OverlayPath[] = projected.map(({ route, xy }) => {
    const view = xy.map(toView);
    const d = view
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join("");
    return {
      id: route.id,
      name: route.name,
      date: route.date,
      distance: route.distance,
      duration: route.duration,
      d,
      startX: view[0].x,
      startY: view[0].y,
    };
  });

  return { width, height, paths, away };
}

export interface OverlayTotals {
  runs: number;
  km: number;
  seconds: number;
}

export function overlayTotals(routes: Pick<OverlayRoute, "distance" | "duration">[]): OverlayTotals {
  return routes.reduce(
    (acc, r) => ({ runs: acc.runs + 1, km: acc.km + r.distance, seconds: acc.seconds + r.duration }),
    { runs: 0, km: 0, seconds: 0 }
  );
}

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
