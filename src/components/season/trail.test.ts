import { pointAlong, trailFraction, TRAIL } from "./trail";

describe("pointAlong", () => {
  const line: [number, number][] = [[0, 0], [10, 0], [10, 10]];
  it("starts at the first point and ends at the last", () => {
    expect(pointAlong(line, 0)).toEqual([0, 0]);
    expect(pointAlong(line, 1)).toEqual([10, 10]);
  });
  it("walks by length, not by vertex", () => {
    expect(pointAlong(line, 0.5)).toEqual([10, 0]);
    expect(pointAlong(line, 0.25)).toEqual([5, 0]);
  });
  it("clamps outside 0..1", () => {
    expect(pointAlong(line, -1)).toEqual([0, 0]);
    expect(pointAlong(line, 2)).toEqual([10, 10]);
  });
  it("has the 10K summit on the trail", () => {
    expect(TRAIL.points).toContainEqual(TRAIL.tenKSummit);
  });
});

describe("trailFraction", () => {
  it("puts the 10K goal date exactly on the 10K summit", () => {
    const f = trailFraction(0.74, 0.74);
    expect(pointAlong(TRAIL.points, f)[0]).toBeCloseTo(TRAIL.tenKSummit[0], 5);
    expect(pointAlong(TRAIL.points, f)[1]).toBeCloseTo(TRAIL.tenKSummit[1], 5);
  });
  it("starts at base camp and ends on the 5K summit", () => {
    expect(trailFraction(0, 0.74)).toBe(0);
    expect(trailFraction(1, 0.74)).toBe(1);
  });
});
