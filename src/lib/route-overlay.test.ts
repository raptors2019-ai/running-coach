import {
  decodePolyline,
  layoutOverlay,
  monthLabel,
  monthRange,
  shiftMonth,
  formatHours,
  overlayTotals,
} from "./route-overlay";

// Encodes a list of lat/lng pairs with Google's polyline algorithm, so the
// tests can build routes without hand-encoding strings.
function encode(points: [number, number][]): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    enc(la - prevLat);
    enc(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

const route = (id: string, points: [number, number][], distance = 5) => ({
  id,
  name: id,
  date: "2026-09-01",
  distance,
  duration: 1500,
  polyline: encode(points),
});

describe("decodePolyline", () => {
  it("decodes Google's reference example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("round-trips the local encoder", () => {
    const pts: [number, number][] = [
      [43.6532, -79.3832],
      [43.6601, -79.3957],
      [43.6426, -79.3871],
    ];
    expect(decodePolyline(encode(pts))).toEqual(pts);
  });
});

describe("layoutOverlay", () => {
  const home: [number, number] = [43.6532, -79.3832];
  const loopA = route("a", [home, [43.66, -79.39], [43.65, -79.4], home]);
  const loopB = route("b", [[43.655, -79.38], [43.665, -79.37], [43.655, -79.38]]);

  it("fits every route inside the viewBox with padding", () => {
    const layout = layoutOverlay([loopA, loopB], { width: 1000, height: 1000, padding: 0.1 });
    expect(layout.paths).toHaveLength(2);
    const coords = layout.paths.flatMap((p) =>
      [...p.d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[2]), Number(m[3])])
    );
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(900);
      expect(y).toBeGreaterThanOrEqual(100);
      expect(y).toBeLessThanOrEqual(900);
    }
    // Something touches the padding edge on the long axis.
    const xs = coords.map(([x]) => x);
    const ys = coords.map(([, y]) => y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(Math.max(spanX, spanY)).toBeCloseTo(800, 0);
  });

  it("confines the drawing to a given area", () => {
    const layout = layoutOverlay([loopA, loopB], {
      width: 1000,
      height: 2000,
      padding: 0,
      area: { x: 0, y: 300, width: 1000, height: 1200 },
    });
    const ys = layout.paths.flatMap((p) => [...p.d.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1])));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(300);
    expect(Math.max(...ys)).toBeLessThanOrEqual(1500);
  });

  it("keeps geography in map mode: shared starts land on the same point", () => {
    const layout = layoutOverlay([loopA, route("c", [home, [43.64, -79.37]])], {
      width: 500,
      height: 500,
    });
    const [a, c] = layout.paths;
    expect(a.startX).toBeCloseTo(c.startX, 1);
    expect(a.startY).toBeCloseTo(c.startY, 1);
  });

  it("drops runs far from home in map mode and reports them", () => {
    const away = route("away", [[51.5, -0.12], [51.51, -0.13]]);
    const layout = layoutOverlay([loopA, loopB, away], { width: 500, height: 500 });
    expect(layout.paths.map((p) => p.id)).toEqual(["a", "b"]);
    expect(layout.away.map((r) => r.id)).toEqual(["away"]);
  });

  it("stacked mode moves every start to one point and keeps far runs", () => {
    const away = route("away", [[51.5, -0.12], [51.51, -0.13]]);
    const layout = layoutOverlay([loopA, loopB, away], { width: 500, height: 500, mode: "stacked" });
    expect(layout.paths).toHaveLength(3);
    expect(layout.away).toHaveLength(0);
    const [first, ...rest] = layout.paths;
    for (const p of rest) {
      expect(p.startX).toBeCloseTo(first.startX, 1);
      expect(p.startY).toBeCloseTo(first.startY, 1);
    }
  });

  it("handles no routes and single-point routes", () => {
    expect(layoutOverlay([], { width: 10, height: 10 }).paths).toEqual([]);
    const dot = route("dot", [[43.65, -79.38]]);
    expect(layoutOverlay([dot], { width: 10, height: 10 }).paths).toEqual([]);
  });
});

describe("month helpers", () => {
  it("labels, ranges and shifts months", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthRange("2026-09")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("totals and formats time", () => {
    expect(overlayTotals([{ distance: 5, duration: 1500 }, { distance: 10.5, duration: 3300 }])).toEqual({
      runs: 2,
      km: 15.5,
      seconds: 4800,
    });
    expect(formatHours(4800)).toBe("1h 20m");
    expect(formatHours(1500)).toBe("25m");
  });
});
