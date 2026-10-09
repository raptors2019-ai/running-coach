import { vo2maxTrend } from "./vo2max";

describe("vo2maxTrend", () => {
  it("returns null with no tests", () => {
    expect(vo2maxTrend([])).toBeNull();
  });

  it("returns only the latest for a single test", () => {
    expect(vo2maxTrend([{ date: "2026-10-09", vo2max: 45.6 }])).toEqual({
      latest: { date: "2026-10-09", vo2max: 45.6 },
    });
  });

  it("compares the two most recent tests regardless of input order", () => {
    const trend = vo2maxTrend([
      { date: "2027-10-09", vo2max: 48.6 },
      { date: "2025-10-09", vo2max: 44 },
      { date: "2026-10-09", vo2max: 45.6 },
    ]);
    expect(trend?.latest.vo2max).toBe(48.6);
    expect(trend?.previous?.vo2max).toBe(45.6);
    expect(trend?.change).toBe(3);
    expect(trend?.changePerYear).toBe(3);
  });

  it("scales the change to a yearly rate", () => {
    const trend = vo2maxTrend([
      { date: "2026-10-09", vo2max: 45.6 },
      { date: "2027-04-09", vo2max: 47.1 },
    ]);
    expect(trend?.change).toBe(1.5);
    expect(trend?.changePerYear).toBeCloseTo(3, 0);
  });

  it("skips the yearly rate when tests are too close together", () => {
    const trend = vo2maxTrend([
      { date: "2026-10-09", vo2max: 45.6 },
      { date: "2026-11-01", vo2max: 46.5 },
    ]);
    expect(trend?.change).toBe(0.9);
    expect(trend?.changePerYear).toBeUndefined();
  });
});
