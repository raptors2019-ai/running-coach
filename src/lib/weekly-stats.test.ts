import { getWeekBounds, getWeeklyStats } from "./weekly-stats";

describe("getWeekBounds", () => {
  it("uses Monday–Sunday weeks, matching plan weeks", () => {
    // Tue Sep 1 2026 → Mon Aug 31 .. Sun Sep 6
    expect(getWeekBounds("2026-09-01")).toEqual({ start: "2026-08-31", end: "2026-09-06" });
  });
  it("keeps Sunday in the week that started the previous Monday", () => {
    expect(getWeekBounds("2026-09-06")).toEqual({ start: "2026-08-31", end: "2026-09-06" });
  });
  it("starts a new week on Monday", () => {
    expect(getWeekBounds("2026-09-07")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });
});

describe("getWeeklyStats", () => {
  const workouts = [
    // Sun Aug 30 — previous plan week, must not count on Tue Sep 1
    { date: "2026-08-30", completed: false, targetDistance: 5 },
    // Mon Aug 31 — this week
    { date: "2026-08-31", completed: true, targetDistance: 0, actualDistance: 5.01 },
    { date: "2026-09-01", completed: false, targetDistance: 7 },
    { date: "2026-09-06", completed: false, targetDistance: 6 },
    // Mon Sep 7 — next week
    { date: "2026-09-07", completed: false, targetDistance: 4 },
  ];
  it("only counts workouts from Monday to Sunday of the current week", () => {
    expect(getWeeklyStats(workouts, "2026-09-01")).toEqual({
      completedCount: 1,
      totalCount: 3,
      completedKm: 5.01,
      plannedKm: 13,
    });
  });
});
