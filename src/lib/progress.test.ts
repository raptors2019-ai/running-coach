import {
  selectPredictionBasis,
  effectiveGoalSeconds,
  buildPaceSeries,
  recentRuns,
  BASELINE_5K_SECONDS,
} from "./progress";

const easyRun = {
  _id: "easy1",
  date: "2026-08-31",
  type: "run",
  title: "Run",
  completed: true,
  actualDistance: 5.01,
  actualDuration: 2194,
  actualPace: "7:17/km",
  isUnplanned: true,
};
const benchmark = {
  _id: "bench",
  date: "2026-08-27",
  type: "race_pace",
  title: "BENCHMARK: 2K Time Trial",
  completed: true,
  actualDistance: 1.98,
  actualDuration: 552,
  actualPace: "4:38/km",
};
const cooldown = {
  _id: "cd",
  date: "2026-08-27",
  type: "run",
  title: "Run",
  completed: true,
  actualDistance: 1.99,
  actualDuration: 943,
  actualPace: "7:53/km",
  isUnplanned: true,
};
const swim = {
  _id: "swim",
  date: "2026-08-12",
  type: "swim",
  title: "Swim",
  completed: true,
  actualDistance: 0.45,
  actualDuration: 1075,
  actualPace: "39:48/km",
  isUnplanned: true,
};
const lift = { _id: "lift", date: "2026-08-25", type: "upper_body", title: "Upper Body", completed: true };
const checkpoint = {
  key: "benchmark_2k" as const,
  date: "2026-08-27",
  resultSeconds: 552,
  resultDistanceKm: 1.98,
  decision: "Passed",
  goalSeconds: 1470,
};

describe("selectPredictionBasis", () => {
  it("prefers the hard benchmark effort over a more recent easy run", () => {
    const basis = selectPredictionBasis([easyRun, benchmark, cooldown, swim, lift], "2026-09-01");
    expect(basis).not.toBeNull();
    expect(basis!.kind).toBe("hard");
    expect(basis!.workout._id).toBe("bench");
    // Riegel: 552 * (5 / 1.98) ^ 1.06 ≈ 1474s
    expect(Math.round(basis!.predictedSeconds)).toBe(1474);
  });

  it("falls back to an easy run and says so when no hard effort exists", () => {
    const basis = selectPredictionBasis([easyRun, cooldown, lift], "2026-09-01");
    expect(basis!.kind).toBe("easy");
    expect(basis!.workout._id).toBe("easy1");
  });

  it("ignores hard efforts older than the lookback window", () => {
    const old = { ...benchmark, _id: "old", date: "2026-04-18" };
    const basis = selectPredictionBasis([old, easyRun], "2026-09-01");
    expect(basis!.kind).toBe("easy");
  });

  it("returns null with no runs", () => {
    expect(selectPredictionBasis([lift, swim], "2026-09-01")).toBeNull();
  });
});

describe("effectiveGoalSeconds", () => {
  it("uses the latest checkpoint-upgraded goal", () => {
    expect(effectiveGoalSeconds({ goalTime: 1500 }, [checkpoint])).toBe(1470);
  });
  it("falls back to the plan goal", () => {
    expect(effectiveGoalSeconds({ goalTime: 1500 }, [])).toBe(1500);
    expect(effectiveGoalSeconds(null, [])).toBe(1500);
  });
});

describe("buildPaceSeries", () => {
  it("includes only runs with parseable pace, split into hard and easy", () => {
    const series = buildPaceSeries([easyRun, benchmark, cooldown, swim, lift]);
    expect(series.map((p) => p.date)).toEqual(["2026-08-27", "2026-08-27", "2026-08-31"]);
    const bench = series.find((p) => p.title.startsWith("BENCHMARK"))!;
    expect(bench.hardSeconds).toBe(278);
    expect(bench.easySeconds).toBeUndefined();
    const easy = series.find((p) => p.date === "2026-08-31")!;
    expect(easy.easySeconds).toBe(437);
    expect(easy.hardSeconds).toBeUndefined();
  });
});

describe("recentRuns", () => {
  it("returns running activities newest first, capped", () => {
    const runs = recentRuns([easyRun, benchmark, cooldown, swim, lift], 2);
    expect(runs.map((r) => r._id)).toEqual(["easy1", "bench"]);
  });
});

it("baseline is the April Foxtrail 5K equivalent", () => {
  expect(BASELINE_5K_SECONDS).toBe(26 * 60 + 25);
});
