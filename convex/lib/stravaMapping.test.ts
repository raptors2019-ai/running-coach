import { inferWeekNumber } from "./stravaMapping";

// Plan starts Tue Aug 25 2026. Plan weeks run Monday–Sunday, so week 1 is the
// partial week Aug 25–30 and week 2 begins Mon Aug 31.
const START = "2026-08-25";

describe("inferWeekNumber", () => {
  it("puts runs before the plan started in week 0", () => {
    expect(inferWeekNumber("2026-08-21", START)).toBe(0);
    expect(inferWeekNumber("2026-08-24", START)).toBe(0);
  });
  it("counts the start date's partial week as week 1", () => {
    expect(inferWeekNumber("2026-08-25", START)).toBe(1);
    expect(inferWeekNumber("2026-08-27", START)).toBe(1);
    expect(inferWeekNumber("2026-08-30", START)).toBe(1);
  });
  it("rolls to week 2 on the following Monday", () => {
    expect(inferWeekNumber("2026-08-31", START)).toBe(2);
    expect(inferWeekNumber("2026-09-06", START)).toBe(2);
    expect(inferWeekNumber("2026-09-07", START)).toBe(3);
  });
  it("lands race day in week 6", () => {
    expect(inferWeekNumber("2026-10-04", START)).toBe(6);
  });
  it("handles a plan that starts on a Monday", () => {
    expect(inferWeekNumber("2026-09-13", "2026-09-07")).toBe(1);
    expect(inferWeekNumber("2026-09-14", "2026-09-07")).toBe(2);
  });
});
