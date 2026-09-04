import {
  normalizeSplits,
  parseDisplayedPace,
  summarizeSplits,
  formatSplitsReport,
  workRepsSummary,
  formatClock,
  type RawSplit,
} from "./splitParsing";

/** The Apple Watch segment screenshot that motivated this feature. */
const SESSION: RawSplit[] = [
  { distance_meters: 1600, duration_seconds: 708, displayed_pace: "7'23\"/km", heart_rate: 159, kind: "warmup" },
  { distance_meters: 800, duration_seconds: 217, displayed_pace: "4'31\"/km", heart_rate: 179, kind: "work" },
  { distance_meters: 400, duration_seconds: 184, displayed_pace: "7'39\"/km", kind: "recovery" },
  { distance_meters: 800, duration_seconds: 231, displayed_pace: "4'48\"/km", heart_rate: 181, kind: "work" },
  { distance_meters: 217, duration_seconds: 241, displayed_pace: "18'31\"/km", heart_rate: 139, kind: "recovery" },
  { distance_meters: 800, duration_seconds: 238, displayed_pace: "4'58\"/km", heart_rate: 176, kind: "work" },
  { distance_meters: 167, duration_seconds: 207, displayed_pace: "20'31\"/km", heart_rate: 140, kind: "recovery" },
  { distance_meters: 800, duration_seconds: 232, displayed_pace: "4'50\"/km", heart_rate: 181, kind: "work" },
  { distance_meters: 121, duration_seconds: 134, displayed_pace: "18'27\"/km", heart_rate: 150, kind: "recovery" },
];

describe("parseDisplayedPace", () => {
  it("reads the watch's prime-and-quote form", () => {
    expect(parseDisplayedPace("7'23\"/km")).toBe(443);
  });

  it("reads a plain colon form", () => {
    expect(parseDisplayedPace("4:31 /km")).toBe(271);
  });

  it("converts a per-mile pace to per-km", () => {
    expect(parseDisplayedPace("8:00/mi")).toBeCloseTo(298.3, 1);
  });

  it("returns null when there is no time token", () => {
    expect(parseDisplayedPace("--")).toBeNull();
    expect(parseDisplayedPace(undefined)).toBeNull();
  });
});

describe("normalizeSplits", () => {
  it("derives pace from distance and time for every row", () => {
    const splits = normalizeSplits(SESSION);
    expect(splits).toHaveLength(9);
    expect(splits[0].paceSecondsPerKm).toBe(443); // 1600 m in 11:48
    expect(splits[1].paceSecondsPerKm).toBe(271); // 800 m in 3:37
  });

  it("accepts the watch's own rounding without flagging a mismatch", () => {
    expect(normalizeSplits(SESSION).some((s) => s.paceMismatch)).toBe(false);
  });

  it("flags a row whose displayed pace contradicts distance and time", () => {
    // 800 m in 3:37 is 4:31/km — a screenshot reading 7:31 means a misread digit.
    const [split] = normalizeSplits([
      { distance_meters: 800, duration_seconds: 217, displayed_pace: "7'31\"/km" },
    ]);
    expect(split.paceMismatch).toBe(true);
  });

  it("drops rows with no readable distance or time, and renumbers", () => {
    const splits = normalizeSplits([
      { distance_meters: 1000, duration_seconds: 300 },
      { distance_meters: 0, duration_seconds: 300 },
      { duration_seconds: 300 },
      { distance_meters: 1000, duration_seconds: 290 },
    ]);
    expect(splits.map((s) => s.index)).toEqual([1, 2]);
  });

  it("keeps only known split kinds", () => {
    const [a, b] = normalizeSplits([
      { distance_meters: 800, duration_seconds: 217, kind: "WORK" },
      { distance_meters: 800, duration_seconds: 217, kind: "sprint-ish" },
    ]);
    expect(a.kind).toBe("work");
    expect(b.kind).toBe("unknown");
  });

  it("ignores a heart rate the screenshot didn't show", () => {
    expect(normalizeSplits(SESSION)[2].heartRate).toBeUndefined();
  });
});

describe("summarizeSplits", () => {
  it("totals the session and averages pace over it", () => {
    const summary = summarizeSplits(normalizeSplits(SESSION));
    expect(summary.totalDistanceMeters).toBe(5705);
    expect(summary.totalDurationSeconds).toBe(2392);
    expect(formatClock(summary.avgPaceSecondsPerKm)).toBe("6:59");
  });

  it("handles an empty list without dividing by zero", () => {
    expect(summarizeSplits([])).toEqual({
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      avgPaceSecondsPerKm: 0,
    });
  });
});

describe("workRepsSummary", () => {
  it("reports the reps, not the meaningless session average", () => {
    expect(workRepsSummary(normalizeSplits(SESSION))).toBe(
      "4 x 800 m @ 4:31, 4:49, 4:58, 4:50 /km"
    );
  });

  it("is absent when nothing was labelled as work", () => {
    expect(workRepsSummary(normalizeSplits([{ distance_meters: 5000, duration_seconds: 1500 }]))).toBeNull();
  });
});

describe("formatSplitsReport", () => {
  it("leads with the totals and the reps, then lists every split", () => {
    const report = formatSplitsReport({
      date: "2026-09-01",
      source: "Apple Watch",
      note: "Legs felt heavy on the third rep",
      splits: normalizeSplits(SESSION),
    });
    expect(report).toContain("Splits — 2026-09-01 (Apple Watch)");
    expect(report).toContain("Total 5.71 km in 39:52 — 6:59/km average");
    expect(report).toContain("4 x 800 m @ 4:31, 4:49, 4:58, 4:50 /km");
    expect(report).toContain("2. 800 m in 3:37 (4:31/km, 179 bpm, work)");
    expect(report).toContain("Note: Legs felt heavy on the third rep");
    expect(report.trimEnd().split("\n").filter((l) => /^\d+\./.test(l))).toHaveLength(9);
  });
});
