import {
  buildWeekRecap,
  defaultCaption,
  RecapWorkout,
  truncate,
  weekHighlight,
  weeksWithRuns,
  wrapText,
} from "./week-recap";

function w(partial: Partial<RecapWorkout> & { date: string }): RecapWorkout {
  return {
    weekNumber: 2,
    type: "easy",
    title: "Easy run",
    completed: false,
    ...partial,
  };
}

// Week 2 of the plan: Mon Aug 31 – Sun Sep 6 2026.
const week2: RecapWorkout[] = [
  w({ date: "2026-08-31", type: "upper_body", title: "Upper Body", completed: true }),
  w({
    date: "2026-09-01",
    type: "intervals",
    title: "8x400m",
    completed: true,
    targetDistance: 7,
    actualDistance: 7.12,
    actualDuration: 2400, // 5:37/km
    actualPace: "5:37/km",
    avgHeartRate: 171,
  }),
  w({ date: "2026-09-02", type: "lower_body", title: "Lower Body", completed: true }),
  w({
    date: "2026-09-03",
    type: "easy",
    title: "Zone 2",
    completed: true,
    targetDistance: 5,
    actualDistance: 5.04,
    actualDuration: 2118, // 7:00/km
    actualPace: "7:00/km",
  }),
  w({ date: "2026-09-05", type: "easy", title: "Partner run", completed: false, targetDistance: 2.5 }),
  w({
    date: "2026-09-06",
    type: "long",
    title: "Long run",
    completed: true,
    targetDistance: 8,
    actualDistance: 8.3,
    actualDuration: 3486, // 7:00/km
    actualPace: "7:00/km",
  }),
];

describe("buildWeekRecap", () => {
  it("totals only the completed runs, not the plan", () => {
    const recap = buildWeekRecap(week2, 2)!;
    expect(recap.runCount).toBe(3);
    expect(recap.totalKm).toBe(20.46);
    expect(recap.totalSeconds).toBe(2400 + 2118 + 3486);
    expect(recap.plannedRuns).toBe(4);
    expect(recap.plannedKm).toBe(22.5);
    expect(recap.completionPct).toBe(75);
  });

  it("counts lifts separately from runs, and lists them only in all mode", () => {
    const runsOnly = buildWeekRecap(week2, 2)!;
    expect(runsOnly.sessionCount).toBe(2);
    expect(runsOnly.supportSummary).toBe("2 lifts");
    expect(runsOnly.entries.every((e) => e.isRun)).toBe(true);

    const all = buildWeekRecap(week2, 2, "all")!;
    expect(all.entries.map((e) => e.date)).toEqual([
      "2026-08-31", // Upper Body
      "2026-09-01",
      "2026-09-02", // Lower Body
      "2026-09-03",
      "2026-09-06",
    ]);
    expect(all.runs).toHaveLength(3);
    expect(all.totalKm).toBe(runsOnly.totalKm); // lifts cover no ground
  });

  it("keeps walks and sub-kilometre blips off the card", () => {
    const week = [
      // Strava maps a Walk to "rest" — never a run, in either mode.
      w({ date: "2026-09-01", type: "rest", title: "Evening Walk", completed: true, actualDistance: 3.2, actualDuration: 2400 }),
      w({ date: "2026-09-02", type: "easy", title: "Warm-up", completed: true, actualDistance: 0.6, actualDuration: 260 }),
      w({ date: "2026-09-03", type: "easy", title: "Zone 2", completed: true, actualDistance: 5, actualDuration: 2100 }),
      // A three-minute "lift" was a mis-started activity, not a session.
      w({ date: "2026-09-04", type: "upper_body", title: "Upper Body", completed: true, actualDuration: 180 }),
    ];
    const all = buildWeekRecap(week, 2, "all")!;
    expect(all.entries.map((e) => e.title)).toEqual(["Zone 2"]);
    expect(all.totalKm).toBe(5);
    expect(all.sessionCount).toBe(0);
  });

  it("counts an unplanned Strava run, which carries the generic run type", () => {
    const recap = buildWeekRecap(
      [w({ date: "2026-09-01", type: "run", title: "Morning Run", completed: true, actualDistance: 6.2, actualDuration: 2400 })],
      2
    )!;
    expect(recap.runCount).toBe(1);
    expect(recap.totalKm).toBe(6.2);
  });

  it("averages pace over distance, not over runs", () => {
    // 8004s across 20.46km = 391.2s/km
    expect(buildWeekRecap(week2, 2)!.avgPace).toBe("6:31");
  });

  it("crowns the fastest and longest run once each", () => {
    const recap = buildWeekRecap(week2, 2)!;
    expect(recap.fastestPace).toBe("5:37");
    expect(recap.longestKm).toBe(8.3);
    expect(recap.runs.filter((r) => r.isFastest).map((r) => r.date)).toEqual(["2026-09-01"]);
    expect(recap.runs.filter((r) => r.isLongest).map((r) => r.date)).toEqual(["2026-09-06"]);
  });

  it("lays out Monday–Sunday with a bar per day", () => {
    const recap = buildWeekRecap(week2, 2)!;
    expect(recap.days.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(recap.days.map((d) => d.km)).toEqual([0, 7.12, 0, 5.04, 0, 0, 8.3]);
    expect(recap.days.filter((d) => d.session).map((d) => d.day)).toEqual([]);
    expect(
      buildWeekRecap(week2, 2, "all")!.days.filter((d) => d.session).map((d) => d.day)
    ).toEqual(["Mon", "Wed"]);
    expect(recap.weekStart).toBe("2026-08-31");
    expect(recap.weekEnd).toBe("2026-09-06");
  });

  it("labels the range by the days the week actually holds", () => {
    // Week 1 starts on a Tuesday, so the label must not claim Monday.
    const week1 = [
      w({ date: "2026-08-25", weekNumber: 1, completed: true, actualDistance: 4, actualDuration: 1680 }),
      w({ date: "2026-08-30", weekNumber: 1, type: "easy", title: "Zone 2", targetDistance: 5 }),
    ];
    const recap = buildWeekRecap(week1, 1)!;
    expect(recap.rangeLabel).toBe("Aug 25 – Aug 30");
    expect(recap.weekStart).toBe("2026-08-24");
  });

  it("falls back to the target distance for a run completed without Strava", () => {
    const recap = buildWeekRecap(
      [w({ date: "2026-09-01", completed: true, targetDistance: 5 })],
      2
    )!;
    expect(recap.totalKm).toBe(5);
    expect(recap.runs[0].pace).toBeUndefined();
    expect(recap.avgPace).toBeUndefined();
  });

  it("returns null for a week with nothing in it", () => {
    expect(buildWeekRecap(week2, 5)).toBeNull();
  });

  it("caps completion at 100 when extra runs got done", () => {
    const recap = buildWeekRecap(
      [
        w({ date: "2026-09-01", completed: true, actualDistance: 5, actualDuration: 1500 }),
        w({ date: "2026-09-02", completed: true, actualDistance: 5, actualDuration: 1500 }),
      ],
      2
    )!;
    expect(recap.completionPct).toBe(100);
  });
});

describe("weeksWithRuns", () => {
  it("lists only weeks that have a logged run", () => {
    const workouts = [
      ...week2,
      w({ date: "2026-09-07", weekNumber: 3, type: "rest", title: "Rest", completed: true }),
      w({ date: "2026-09-08", weekNumber: 3, type: "tempo", title: "Tempo", targetDistance: 6 }),
    ];
    expect(weeksWithRuns(workouts)).toEqual([2]);
  });
});

describe("defaultCaption", () => {
  it("is short enough to sit big on the card", () => {
    const caption = defaultCaption(buildWeekRecap(week2, 2)!);
    expect(caption).toBe("s/o to me for putting in the work");
    expect(wrapText(caption, 26, 2)).toHaveLength(2);
  });
});

describe("wrapText", () => {
  it("wraps on whole words", () => {
    expect(wrapText("s/o to me for putting in the work", 14)).toEqual([
      "s/o to me for",
      "putting in the",
      "work",
    ]);
  });

  it("ellipses past the line budget", () => {
    expect(wrapText("one two three four five six", 8, 2)).toEqual(["one two", "three…"]);
  });

  it("keeps a word longer than the line rather than dropping it", () => {
    expect(wrapText("supercalifragilistic run", 5, 3)).toEqual(["supercalifragilistic", "run"]);
  });

  it("returns nothing for an empty caption", () => {
    expect(wrapText("   ", 20)).toEqual([]);
  });
});

describe("truncate", () => {
  it("leaves a title that fits alone", () => {
    expect(truncate("8x400m", 12)).toBe("8x400m");
  });
  it("ellipses a title that overruns its row", () => {
    expect(truncate("WU 1.5km + 8x400m + CD", 12)).toBe("WU 1.5km +…");
  });
});

describe("weekHighlight", () => {
  it("calls out a week that got fully done", () => {
    const recap = buildWeekRecap(week2, 2)!;
    expect(weekHighlight({ ...recap, runCount: 4, plannedRuns: 4 })).toBe("Every run on the board");
  });
  it("counts the runs banked when the week fell short", () => {
    expect(weekHighlight(buildWeekRecap(week2, 2)!)).toBe("3 of 4 runs in the bank");
  });
  it("says nothing about a plan for runs logged before one existed", () => {
    const recap = buildWeekRecap(
      [w({ date: "2026-08-18", weekNumber: 0, type: "race", title: "Foxtrail", completed: true, actualDistance: 10.3 })],
      0
    )!;
    expect(recap.plannedRuns).toBe(1);
    expect(weekHighlight({ ...recap, plannedRuns: 0 })).toBe("Before the plan even started");
  });
});
