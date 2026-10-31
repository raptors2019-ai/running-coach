import {
  activityNameFor,
  appleSyncReset,
  coerceDistanceKm,
  coerceDurationSeconds,
  coerceKcal,
  coerceNumber,
  detailForPrompt,
  downsample,
  hrByQuarter,
  isSameActivity,
  mapAppleType,
  mapAppleWorkoutType,
  minutesInHrBands,
  parseAppleWorkout,
  parseDateMs,
  secretsMatch,
  toSyncedActivity,
  torontoLocalTime,
  MAX_HR_POINTS,
  MAX_RAW_CHARS,
  type AppleWorkout,
} from "./appleHealth";
import { mapStravaTypeToWorkoutType } from "./stravaMapping";

function parsed(body: unknown): AppleWorkout {
  const r = parseAppleWorkout(body);
  if (!r.ok) throw new Error(r.error);
  return r.workout;
}

describe("secretsMatch", () => {
  it("accepts only the exact secret", () => {
    expect(secretsMatch("s3cret-value", "s3cret-value")).toBe(true);
    expect(secretsMatch("s3cret-valuf", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret-value-and-more", "s3cret-value")).toBe(false);
    expect(secretsMatch(null, "s3cret-value")).toBe(false);
  });
  it("rejects everything when the env var is unset or empty", () => {
    expect(secretsMatch("", undefined)).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("anything", undefined)).toBe(false);
  });
});

describe("coercion", () => {
  it("strips units and thousands separators", () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber("1,234 kcal")).toBe(1234);
    expect(coerceNumber("1,234.5")).toBe(1234.5);
    expect(coerceNumber("5.2 km")).toBe(5.2);
    expect(coerceNumber("145 bpm")).toBe(145);
    expect(coerceNumber("5,2")).toBe(5.2); // a lone decimal comma
    expect(coerceNumber("1 234")).toBe(1234); // iOS narrow no-break space
    expect(coerceNumber("n/a")).toBeUndefined();
    expect(coerceNumber(NaN)).toBeUndefined();
    expect(coerceNumber(null)).toBeUndefined();
  });
  it("converts distance units to km", () => {
    expect(coerceDistanceKm("5 km")).toBe(5);
    expect(coerceDistanceKm("800 m")).toBeCloseTo(0.8);
    expect(coerceDistanceKm("3.1 mi")).toBeCloseTo(4.989, 3);
    expect(coerceDistanceKm(10.02)).toBe(10.02);
  });
  it("reads durations as seconds, clock times, or with units", () => {
    expect(coerceDurationSeconds(2700)).toBe(2700);
    expect(coerceDurationSeconds("2,700")).toBe(2700);
    expect(coerceDurationSeconds("1:02:03")).toBe(3723);
    expect(coerceDurationSeconds("32:15")).toBe(1935);
    expect(coerceDurationSeconds("45 min")).toBe(2700);
    expect(coerceDurationSeconds("1 hr, 5 min")).toBe(3900);
    expect(coerceDurationSeconds("90 s")).toBe(90);
  });
  it("converts kJ to kcal", () => {
    expect(coerceKcal("612 kcal")).toBe(612);
    expect(coerceKcal("2,000 kJ")).toBeCloseTo(478, 0);
  });
});

describe("parseDateMs", () => {
  // Oct 31 2026 is EDT (UTC-4); Jan 15 is EST (UTC-5).
  const oct31_0705_local = Date.UTC(2026, 9, 31, 11, 5);
  it("reads ISO 8601 with an offset or Z", () => {
    expect(parseDateMs("2026-10-31T07:05:00-04:00")).toBe(oct31_0705_local);
    expect(parseDateMs("2026-10-31T11:05:00Z")).toBe(oct31_0705_local);
    expect(parseDateMs("2026-10-31T11:05:00.000Z")).toBe(oct31_0705_local);
    expect(parseDateMs("2026-10-31 07:05:00 -0400")).toBe(oct31_0705_local);
  });
  it("reads zone-less times as Toronto time, DST-aware", () => {
    expect(parseDateMs("2026-10-31T07:05:00")).toBe(oct31_0705_local);
    expect(parseDateMs("2026-01-15 07:05")).toBe(Date.UTC(2026, 0, 15, 12, 5));
  });
  it("reads Shortcuts-style dates", () => {
    expect(parseDateMs("Oct 31, 2026 at 7:05 AM")).toBe(oct31_0705_local);
    expect(parseDateMs("Oct 31, 2026 at 7:05 AM")).toBe(oct31_0705_local);
    expect(parseDateMs("Saturday, October 31, 2026 at 7:05 AM")).toBe(oct31_0705_local);
    expect(parseDateMs("October 31, 2026 at 7:05:00 AM EDT")).toBe(oct31_0705_local);
    expect(parseDateMs("31 Oct 2026 at 19:05")).toBe(Date.UTC(2026, 9, 31, 23, 5));
    expect(parseDateMs("Oct 31, 2026, 12:30 AM")).toBe(Date.UTC(2026, 9, 31, 4, 30));
    expect(parseDateMs("Jan 15, 2026 at 7:05 PM")).toBe(Date.UTC(2026, 0, 16, 0, 5));
  });
  it("reads epoch seconds and milliseconds", () => {
    expect(parseDateMs(oct31_0705_local / 1000)).toBe(oct31_0705_local);
    expect(parseDateMs(String(oct31_0705_local))).toBe(oct31_0705_local);
  });
  it("rejects what isn't a date", () => {
    expect(parseDateMs("yesterday")).toBeUndefined();
    expect(parseDateMs("2026-13-01")).toBeUndefined();
    expect(parseDateMs(undefined)).toBeUndefined();
  });
});

describe("torontoLocalTime", () => {
  it("anchors the date to Toronto, not UTC", () => {
    // 03:30 UTC on Nov 1 is still the evening of Oct 31 in Toronto.
    expect(torontoLocalTime(Date.UTC(2026, 10, 1, 3, 30))).toBe("2026-10-31T23:30:00");
  });
});

describe("mapAppleType", () => {
  it.each([
    ["Running", "Run"],
    ["Outdoor Run", "Run"],
    ["HKWorkoutActivityTypeRunning", "Run"],
    ["Walking", "Walk"],
    ["Hiking", "Hike"],
    ["Cycling", "Ride"],
    ["Indoor Cycle", "VirtualRide"],
    ["Swimming", "Swim"],
    ["Pool Swim", "Swim"],
    ["Traditional Strength Training", "WeightTraining"],
    ["functionalStrengthTraining", "WeightTraining"],
    ["High Intensity Interval Training", "HighIntensityIntervalTraining"],
    ["Yoga", "Yoga"],
    ["Elliptical", "Elliptical"],
    ["Rowing", "Rowing"],
    ["Basketball", "Workout"],
    ["Pickleball", "Workout"],
  ])("%s -> %s", (apple, strava) => {
    expect(mapAppleType(apple)).toBe(strava);
  });
});

describe("mapAppleWorkoutType", () => {
  it("lands each Apple type where the Strava sync put the same activity", () => {
    expect(mapAppleWorkoutType("Running", "Morning Run")).toBe("run");
    expect(mapAppleWorkoutType("Walking", "Lunch Walk")).toBe("rest");
    expect(mapAppleWorkoutType("Swimming", "Morning Swim")).toBe("swim");
    expect(mapAppleWorkoutType("Cycling", "Evening Ride")).toBe("cross_training");
    expect(mapAppleWorkoutType("Basketball", "Night Basketball")).toBe("cross_training");
    expect(mapAppleWorkoutType("Yoga", "Morning Yoga")).toBe("cross_training");
    expect(mapAppleWorkoutType("High Intensity Interval Training", "Lunch HIIT")).toBe("cross_training");
    expect(mapAppleWorkoutType("Pickleball", "Evening Pickleball")).toBe("cross_training");
  });
  it("treats strength training like Strava's 'Evening Weight Training'", () => {
    const strava = mapStravaTypeToWorkoutType("WeightTraining", "Evening Weight Training");
    expect(mapAppleWorkoutType("Traditional Strength Training", "Evening Traditional Strength Training")).toBe(strava);
    expect(strava).toBe("cross_training");
    expect(mapAppleWorkoutType("Traditional Strength Training", "Upper body push")).toBe("upper_body");
    expect(mapAppleWorkoutType("Functional Strength Training", "Leg day")).toBe("lower_body");
  });
});

describe("activityNameFor", () => {
  it("names workouts the way Strava did", () => {
    expect(activityNameFor("Running", "2026-10-31T07:05:00")).toBe("Morning Run");
    expect(activityNameFor("Traditional Strength Training", "2026-10-31T18:00:00")).toBe("Evening Traditional Strength Training");
    expect(activityNameFor("Basketball", "2026-10-31T21:30:00")).toBe("Night Basketball");
    expect(activityNameFor("highIntensityIntervalTraining", "2026-10-31T12:15:00")).toBe("Lunch High Intensity Interval Training");
  });
});

describe("parseAppleWorkout", () => {
  it("normalises a run sent as Shortcuts text", () => {
    const hr = Array.from({ length: 1200 }, (_, i) => [String(i * 2), `${140 + (i % 20)} bpm`]);
    const w = parsed({
      id: "2026-10-31T07:05:00-04:00-Running",
      type: "Running",
      start: "Oct 31, 2026 at 7:05 AM",
      end: "Oct 31, 2026 at 7:45 AM",
      durationS: "2,400",
      distanceKm: "8.02 km",
      activeEnergyKcal: "512 kcal",
      elevationGainM: "35 m",
      avgCadence: "172 spm",
      indoor: "No",
      hr,
    });
    expect(w.activityId).toBe("ah:2026-10-31T07:05:00-04:00-Running");
    expect(w.date).toBe("2026-10-31");
    expect(w.startTime).toBe("2026-10-31T07:05:00");
    expect(w.durationS).toBe(2400);
    expect(w.distanceKm).toBe(8.02);
    expect(w.activeEnergyKcal).toBe(512);
    expect(w.indoor).toBe(false);
    expect(w.hr!.length).toBeLessThanOrEqual(MAX_HR_POINTS);
    expect(w.avgHR).toBeGreaterThan(140); // derived from the series
    expect(w.maxHR).toBeLessThanOrEqual(159);
    expect(w.name).toBe("Morning Run");
    const activity = toSyncedActivity(w);
    expect(activity.mappedType).toBe("run");
    expect(activity.stravaActivityId).toBe("ah:2026-10-31T07:05:00-04:00-Running");
  });

  it("takes avg/max/min HR from the full series, not the downsampled one", () => {
    // 1200 samples at 130 bpm with a one-sample spike and dip; downsampling
    // to 600 points averages each into a neighbour (165, 105).
    const hr = Array.from({ length: 1200 }, (_, i) => [i, i === 500 ? 200 : i === 900 ? 80 : 130]);
    const w = parsed({ id: "spike", type: "Running", start: "2026-10-31T07:05:00-04:00", durationS: 1200, hr });
    expect(w.hr!.length).toBeLessThanOrEqual(MAX_HR_POINTS);
    expect(Math.max(...w.hr!.map((p) => p[1]))).toBeLessThan(200);
    expect(Math.min(...w.hr!.map((p) => p[1]))).toBeGreaterThan(80);
    expect(w.maxHR).toBe(200);
    expect(w.minHR).toBe(80);
    expect(w.avgHR).toBe(130);
  });

  it("drops invalid HR samples before computing stats", () => {
    const hr = [[0, 300], [60, 150], [120, "junk"], [180, 10], [240, 160]];
    const w = parsed({ id: "noisy", type: "Running", start: "2026-10-31T07:05:00-04:00", durationS: 300, hr });
    expect(w.hr).toEqual([[60, 150], [240, 160]]);
    expect(w).toMatchObject({ avgHR: 155, maxHR: 160, minHR: 150 });
  });

  it("takes a strength session with no distance and no heart rate", () => {
    const w = parsed({ id: "lift-1", type: "Traditional Strength Training", start: "2026-10-30T18:10:00-04:00", durationS: 3300 });
    expect(w.distanceKm).toBeUndefined();
    expect(w.hr).toBeUndefined();
    expect(w.avgHR).toBeUndefined();
    const activity = toSyncedActivity(w);
    expect(activity.actualDistance).toBe(0);
    expect(activity.mappedType).toBe("cross_training");
    expect(activity.mappedTitle).toBe("Cross Training");
    expect(activity.activityName).toBe("Evening Traditional Strength Training");
  });

  it("takes basketball with energy, HR samples as dated objects, and extras", () => {
    const w = parsed({
      id: 98765,
      type: "Basketball",
      start: "2026-10-29T20:30:00-04:00",
      end: "2026-10-29T22:00:00-04:00",
      distanceKm: "",
      activeEnergyKcal: "1,012 kcal",
      totalEnergyKcal: "1,180 kcal",
      maxHR: "186",
      hr: [
        { date: "2026-10-29T20:31:00-04:00", value: "120" },
        { date: "2026-10-29T21:00:00-04:00", value: "165" },
        { date: "Oct 29, 2026 at 9:30 PM", value: 172 },
        { date: "bad", value: 150 },
        { date: "2026-10-29T21:45:00-04:00", value: 400 }, // not a heart rate
      ],
      weather: { temperature: "12 °C", humidity: "60%" },
      device: "Apple Watch",
      court: "Rec centre",
    });
    expect(w.activityId).toBe("ah:98765");
    expect(w.durationS).toBe(5400); // from start/end
    expect(w.distanceKm).toBeUndefined();
    expect(w.activeEnergyKcal).toBe(1012);
    expect(w.totalEnergyKcal).toBe(1180);
    expect(w.hr).toEqual([[60, 120], [1800, 165], [3600, 172]]);
    expect(w.maxHR).toBe(186); // sent value wins over the series
    expect(w.minHR).toBe(120);
    expect(w.weather).toContain("12 °C");
    expect(w.raw).toBe(JSON.stringify({ court: "Rec centre" }));
    expect(w.date).toBe("2026-10-29");
    expect(toSyncedActivity(w).mappedType).toBe("cross_training");
    expect(toSyncedActivity(w).activityName).toBe("Evening Basketball");
  });

  it("keeps laps and route, and caps the raw extras", () => {
    const w = parsed({
      id: "ride-1",
      type: "Cycling",
      start: "2026-10-28T17:00:00-04:00",
      durationS: "1:00:00",
      laps: [{ durationS: "10:00", distanceKm: "5 km", avgHR: "130" }, "junk"],
      route: Array.from({ length: 3000 }, (_, i) => [43.6 + i / 1e5, -79.4, 80]),
      huge: "x".repeat(MAX_RAW_CHARS),
      small: 1,
    });
    expect(w.laps).toEqual([{ durationS: 600, distanceKm: 5, avgHR: 130 }]);
    expect(w.route!.length).toBe(1000);
    expect(w.route![0]).toEqual([43.6, -79.4, 80]);
    const raw = JSON.parse(w.raw!);
    expect(raw).toEqual({ small: 1, _dropped: ["huge"] });
    expect(w.raw!.length).toBeLessThanOrEqual(MAX_RAW_CHARS);
  });

  it("returns 400-worthy errors for unusable payloads without echoing values", () => {
    expect(parseAppleWorkout([1, 2])).toEqual({ ok: false, error: expect.any(String) });
    expect(parseAppleWorkout(null).ok).toBe(false);
    expect(parseAppleWorkout({ type: "Running", start: "2026-10-31T07:00:00Z", durationS: 60 }).ok).toBe(false);
    expect(parseAppleWorkout({ id: "a", start: "2026-10-31T07:00:00Z", durationS: 60 }).ok).toBe(false);
    expect(parseAppleWorkout({ id: "a", type: "Running", durationS: 60 }).ok).toBe(false);
    expect(parseAppleWorkout({ id: "a", type: "Running", start: "2026-10-31T07:00:00Z" }).ok).toBe(false);
    expect(parseAppleWorkout({ id: "a", type: "Running", start: "2026-10-31T07:00:00Z", durationS: "0 s" }).ok).toBe(false);
    const r = parseAppleWorkout({ id: "a", type: "Running", start: "secret-looking-value", durationS: 60 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain("secret-looking-value");
  });
});

describe("series helpers", () => {
  it("downsamples to the cap and keeps the average", () => {
    const pts = Array.from({ length: 1200 }, (_, i) => [i, i % 2 === 0 ? 100 : 200]);
    const out = downsample(pts, 600);
    expect(out.length).toBe(600);
    expect(out.every((p) => p[1] === 150)).toBe(true);
    expect(downsample(pts.slice(0, 10), 600).length).toBe(10);
  });
  it("summarises HR into bands and quarters for the coach", () => {
    const hr = Array.from({ length: 60 }, (_, i) => [i * 60, i < 30 ? 110 : 165]);
    expect(minutesInHrBands(hr, 3600)).toEqual({ "<120": 30, "160-174": 30 });
    expect(hrByQuarter(hr, 3600)).toEqual([110, 110, 165, 165]);
    const w = parsed({ id: "b", type: "Basketball", start: "2026-10-29T20:30:00-04:00", durationS: 3600, activeEnergyKcal: 700, hr });
    expect(detailForPrompt(w)).toMatchObject({
      source: "Apple Health",
      appleType: "Basketball",
      durationMin: 60,
      activeKcal: 700,
      maxHR: 165,
      hrMinutesByBand: { "<120": 30, "160-174": 30 },
    });
  });
});

describe("isSameActivity (dedupe against Strava)", () => {
  const apple = { startTime: "2026-10-31T07:05:00", durationS: 2400, isRun: true };
  it("matches starts within 5 minutes, ignoring Strava's fake Z", () => {
    expect(isSameActivity(apple, { startTime: "2026-10-31T07:08:30Z", durationS: 2300, isRun: true })).toBe(true);
    expect(isSameActivity(apple, { startTime: "2026-10-31T07:00:00Z", durationS: 9999, isRun: false })).toBe(true);
  });
  it("keeps two workouts more than 5 minutes apart", () => {
    expect(isSameActivity(apple, { startTime: "2026-10-31T07:11:00Z", durationS: 2400, isRun: true })).toBe(false);
    // a warmup and the main effort of the same session
    expect(isSameActivity(apple, { startTime: "2026-10-31T06:50:00Z", durationS: 600, isRun: true })).toBe(false);
  });
  it("falls back to kind and duration when the Strava row has no start time", () => {
    expect(isSameActivity(apple, { durationS: 2280, isRun: true })).toBe(true); // moving vs elapsed time
    expect(isSameActivity(apple, { durationS: 2400, isRun: false })).toBe(false);
    expect(isSameActivity(apple, { durationS: 1200, isRun: true })).toBe(false);
    const lift = { startTime: "2026-10-30T18:10:00", durationS: 3300, isRun: false };
    expect(isSameActivity(lift, { durationS: 3480, isRun: false })).toBe(true);
    expect(isSameActivity(lift, { durationS: 6360, isRun: false })).toBe(false); // a basketball game that day
  });
});

describe("appleSyncReset", () => {
  it("removes unplanned Apple rows and reopens the planned row an Apple workout completed", () => {
    const { remove, reopen } = appleSyncReset([
      { _id: "p", title: "Tempo 6K", stravaActivityId: "ah:wu", notes: "Legs felt heavy" },
      { _id: "u", title: "Run", isUnplanned: true, stravaActivityId: "ah:cd" },
      { _id: "s", title: "Ride", isUnplanned: true, stravaActivityId: "12345" },
    ]);
    expect(remove).toEqual(["u"]);
    expect(reopen).toHaveLength(1);
    expect(reopen[0].id).toBe("p");
    expect(reopen[0].patch).toMatchObject({ completed: false, stravaActivityId: undefined });
    expect("notes" in reopen[0].patch).toBe(false); // the athlete's note stays
  });

  it("restores the planned type and title a mismatched activity took over", () => {
    const { reopen } = appleSyncReset([
      {
        _id: "p",
        title: "Cross Training",
        stravaActivityId: "ah:lift",
        originalType: "tempo",
        notes: "Originally planned: Tempo 6K. Did: Morning Traditional Strength Training",
      },
    ]);
    expect(reopen[0].patch).toMatchObject({ type: "tempo", title: "Tempo 6K", originalType: undefined, notes: undefined });
  });

  it("leaves Strava rows and hand completions alone", () => {
    expect(
      appleSyncReset([
        { _id: "p", title: "Easy Run", stravaActivityId: "999" },
        { _id: "q", title: "Long Run" },
      ])
    ).toEqual({ remove: [], reopen: [] });
  });
});
