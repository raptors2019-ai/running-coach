import { getWeekBounds, getWeekSummary, getWeeklyStats } from "./weekly-stats";

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

// Week 2 of the plan as it looked on Tue Sep 1: a lift and a Strava run on
// Monday (the run wasn't on the plan), four planned runs still to come.
const week2 = [
  { date: "2026-08-31", type: "upper_body", title: "Upper Body", completed: true },
  { date: "2026-08-31", type: "cross_training", title: "Cross Training", completed: true, isUnplanned: true },
  { date: "2026-08-31", type: "run", title: "Run", completed: true, actualDistance: 5.01, isUnplanned: true },
  { date: "2026-09-01", type: "intervals", title: "VO2 Max", completed: false, targetDistance: 7 },
  { date: "2026-09-02", type: "lower_body", title: "Lower Body", completed: false },
  { date: "2026-09-03", type: "easy", title: "Zone 2", completed: false, targetDistance: 5 },
  { date: "2026-09-04", type: "rest", title: "Rest Day", completed: false },
  { date: "2026-09-05", type: "easy", title: "Partner Run", completed: false, targetDistance: 2.5 },
  { date: "2026-09-06", type: "long", title: "Long Run", completed: false, targetDistance: 6 },
];

describe("getWeekSummary", () => {
  it("counts runs, not every session, and only km actually run", () => {
    expect(getWeekSummary(week2)).toEqual({
      runsPlanned: 4,
      runsDone: 0,
      runsMissed: 0,
      extraRuns: 1,
      plannedKm: 20.5,
      actualKm: 5,
      otherPlanned: 2,
      otherDone: 1,
    });
  });

  it("credits a planned run done on another day, and flags missed ones", () => {
    const week1 = [
      { date: "2026-08-29", type: "easy", completed: false, targetDistance: 2.5, missedAt: 1 },
      // Sunday's long run, made up Monday: still Sunday's row in the plan.
      { date: "2026-08-30", type: "long", completed: true, targetDistance: 5, actualDistance: 5.01 },
    ];
    expect(getWeekSummary(week1)).toMatchObject({
      runsPlanned: 2,
      runsDone: 1,
      runsMissed: 1,
      extraRuns: 0,
      plannedKm: 7.5,
      actualKm: 5,
    });
  });

  it("keeps a re-typed planned run in the run count but not as done", () => {
    const rows = [
      { date: "2026-09-03", type: "cross_training", originalType: "easy", completed: true, targetDistance: 5 },
    ];
    expect(getWeekSummary(rows)).toMatchObject({ runsPlanned: 1, runsDone: 0, actualKm: 0 });
  });

  it("counts warmup/cooldown segment rows toward km but not as extra runs", () => {
    const rows = [
      { date: "2026-09-01", type: "intervals", completed: true, targetDistance: 7, actualDistance: 3.2 },
      { date: "2026-09-01", type: "run", title: "Warmup — VO2 Max", completed: true, actualDistance: 1.5, isUnplanned: true },
      { date: "2026-09-01", type: "run", title: "Cooldown — VO2 Max", completed: true, actualDistance: 1, isUnplanned: true },
    ];
    expect(getWeekSummary(rows)).toMatchObject({ runsDone: 1, extraRuns: 0, actualKm: 5.7 });
  });
});

describe("getWeeklyStats", () => {
  const workouts = [
    // Sun Aug 30 — previous plan week, must not count on Tue Sep 1
    { date: "2026-08-30", type: "long", completed: false, targetDistance: 5 },
    ...week2,
    // Mon Sep 7 — next week
    { date: "2026-09-07", type: "easy", completed: false, targetDistance: 4 },
  ];
  it("only counts workouts from Monday to Sunday of the current week", () => {
    expect(getWeeklyStats(workouts, "2026-09-01")).toMatchObject({
      runsPlanned: 4,
      runsDone: 0,
      extraRuns: 1,
      actualKm: 5,
      plannedKm: 20.5,
    });
  });
});
