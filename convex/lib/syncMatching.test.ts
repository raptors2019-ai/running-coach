import { isPlaceholderCompletion, choosePlannedRow, pickBestActivity, adoptUnplannedRun } from "./syncMatching";

const planned = (over: Record<string, unknown> = {}) => ({
  _id: "planned",
  type: "easy",
  title: "Partner Easy Run",
  targetPace: "7:00+",
  completed: false,
  ...over,
});

describe("isPlaceholderCompletion", () => {
  it("is true for a completed planned row with no Strava activity", () => {
    expect(isPlaceholderCompletion(planned({ completed: true, actualDistance: 2.5 }))).toBe(true);
  });
  it("is false once a Strava activity is attached", () => {
    expect(isPlaceholderCompletion(planned({ completed: true, stravaActivityId: "1" }))).toBe(false);
  });
  it("is false for uncompleted and unplanned rows", () => {
    expect(isPlaceholderCompletion(planned())).toBe(false);
    expect(isPlaceholderCompletion(planned({ completed: true, isUnplanned: true }))).toBe(false);
  });
});

describe("choosePlannedRow", () => {
  it("prefers an uncompleted planned row over a placeholder", () => {
    const open = planned({ _id: "open" });
    const placeholder = planned({ _id: "ph", completed: true });
    expect(choosePlannedRow([placeholder, open])?._id).toBe("open");
  });
  it("falls back to a placeholder-completed planned row", () => {
    const placeholder = planned({ _id: "ph", completed: true, actualDistance: 2.5 });
    expect(choosePlannedRow([placeholder])?._id).toBe("ph");
  });
  it("ignores unplanned rows and rows already synced", () => {
    const synced = planned({ _id: "s", completed: true, stravaActivityId: "1" });
    const unplanned = planned({ _id: "u", isUnplanned: true, completed: true });
    expect(choosePlannedRow([synced, unplanned])).toBeUndefined();
  });
});

describe("pickBestActivity", () => {
  const tt = { mappedType: "run", actualDistance: 2, actualDuration: 552 }; // 4:36/km
  const warmup = { mappedType: "run", actualDistance: 1.5, actualDuration: 630 }; // 7:00/km
  const lift = { mappedType: "cross_training", actualDistance: 0, actualDuration: 3000 };

  it("prefers the activity whose type fits the plan", () => {
    expect(pickBestActivity(planned({ type: "easy" }), [lift, warmup])).toBe(1);
  });
  it("breaks type ties by pace closest to the target", () => {
    const plan = planned({ type: "race_pace", targetPace: "4:45-4:55" });
    expect(pickBestActivity(plan, [warmup, tt])).toBe(1);
  });
  it("prefers the longest activity when there is no target pace", () => {
    const plan = planned({ type: "easy", targetPace: undefined });
    const longSlow = { mappedType: "run", actualDistance: 3, actualDuration: 1260 }; // 7:00/km
    expect(pickBestActivity(plan, [longSlow, tt])).toBe(0);
  });
  it("returns -1 for no candidates", () => {
    expect(pickBestActivity(planned(), [])).toBe(-1);
  });
});

describe("adoptUnplannedRun", () => {
  const placeholder = planned({ completed: true, actualDistance: 2.5 });
  const eveningRun = {
    _id: "u1",
    type: "run",
    title: "Run",
    isUnplanned: true,
    completed: true,
    actualDistance: 3.42,
    actualDuration: 1561,
    actualPace: "7:36/km",
    avgHeartRate: 165,
    stravaActivityId: "20095398541",
  };

  it("folds a same-day unplanned run into a placeholder-completed planned run", () => {
    const result = adoptUnplannedRun([placeholder, eveningRun]);
    expect(result).toEqual({
      plannedId: "planned",
      unplannedId: "u1",
      patch: {
        completed: true,
        missedAt: undefined,
        actualDistance: 3.42,
        actualDuration: 1561,
        actualPace: "7:36/km",
        avgHeartRate: 165,
        stravaActivityId: "20095398541",
      },
    });
  });
  it("picks the best-fitting unplanned row when there are several", () => {
    const lift = { ...eveningRun, _id: "u2", type: "cross_training", actualDistance: 0, actualDuration: 3000, stravaActivityId: "2" };
    expect(adoptUnplannedRun([placeholder, lift, eveningRun])?.unplannedId).toBe("u1");
  });
  it("does nothing when the planned row is already synced or still open", () => {
    expect(adoptUnplannedRun([planned({ completed: true, stravaActivityId: "9" }), eveningRun])).toBeNull();
    expect(adoptUnplannedRun([planned(), eveningRun])).toBeNull();
  });
  it("does nothing when the only unplanned row is a different kind of activity", () => {
    const lift = { ...eveningRun, type: "cross_training" };
    expect(adoptUnplannedRun([placeholder, lift])).toBeNull();
  });
});
