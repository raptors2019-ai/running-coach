import { fillSlots, weekRuns, slotWeekStats, type MatchableRun } from "./slotMatching";
import type { Slot } from "./slots";

const slot = (over: Partial<Slot> & Pick<Slot, "id" | "kind">): Slot => ({
  type: over.kind === "quality" ? "intervals" : over.kind,
  title: over.id,
  description: "",
  optional: false,
  ...over,
});

const run = (id: string, km: number, pace: string, over: Partial<MatchableRun> = {}): MatchableRun => {
  const [m, s] = pace.split(":").map(Number);
  return {
    _id: id,
    date: "2026-10-12",
    type: "run",
    title: "Morning Run",
    completed: true,
    actualDistance: km,
    actualDuration: Math.round(km * (m * 60 + s)),
    ...over,
  };
};

const WEEK: Slot[] = [
  slot({ id: "long", kind: "long" }),
  slot({ id: "q1", kind: "quality" }),
  slot({ id: "easy", kind: "easy", optional: true }),
];

describe("fillSlots", () => {
  it("lets a pinned run win over the automatic choice", () => {
    const slots = [{ ...WEEK[0], pinnedWorkoutId: "short" }, WEEK[1], WEEK[2]];
    const { fills } = fillSlots(slots, [run("big", 15, "7:11"), run("short", 5, "7:00")]);
    expect(fills.long?._id).toBe("short");
  });

  it("falls back to auto-matching when the pinned run is gone", () => {
    const slots = [{ ...WEEK[0], pinnedWorkoutId: "gone" }, WEEK[1], WEEK[2]];
    const { fills } = fillSlots(slots, [run("big", 15, "7:11"), run("short", 5, "7:00")]);
    expect(fills.long?._id).toBe("big");
  });

  it("fills quality with a quality-typed run before a faster plain run", () => {
    const { fills } = fillSlots(WEEK, [
      run("typed", 8, "6:30", { type: "intervals" }),
      run("fast", 6, "5:30"),
    ]);
    expect(fills.q1?._id).toBe("typed");
  });

  it("fills quality by pace, long by distance, easy with the rest", () => {
    const { fills, extras } = fillSlots(WEEK, [
      run("long15", 15.07, "7:11"),
      run("track", 8, "6:22"),
      run("easy5", 5, "7:00"),
    ]);
    expect(fills.q1?._id).toBe("track");
    expect(fills.long?._id).toBe("long15");
    expect(fills.easy?._id).toBe("easy5");
    expect(extras).toHaveLength(0);
  });

  it("does not use a run under 3 km for quality", () => {
    const { fills } = fillSlots([WEEK[1]], [run("jog", 2.2, "5:40")]);
    expect(fills.q1).toBeNull();
  });

  it("gives a skipped slot nothing", () => {
    const slots = [WEEK[0], { ...WEEK[1], skipped: true }];
    const { fills, extras } = fillSlots(slots, [run("long15", 15, "7:11"), run("track", 8, "6:22")]);
    expect(fills.q1).toBeNull();
    expect(extras.map((r) => r._id)).toEqual(["track"]);
  });

  it("returns leftover runs as extras", () => {
    const { extras } = fillSlots(WEEK, [
      run("a", 15, "7:11"),
      run("b", 8, "6:22"),
      run("c", 5, "7:00"),
      run("d", 4, "7:20"),
    ]);
    expect(extras.map((r) => r._id)).toEqual(["d"]);
  });

  it("leaves every slot open in a week with no runs", () => {
    const { fills, extras } = fillSlots(WEEK, []);
    expect(fills).toEqual({ long: null, q1: null, easy: null });
    expect(extras).toEqual([]);
  });
});

describe("weekRuns", () => {
  it("keeps completed runs and drops segments, non-runs and placeholders without distance", () => {
    const rows: MatchableRun[] = [
      run("main", 8, "6:22", { type: "intervals" }),
      run("wu", 1.6, "8:12", { title: "Warmup — Track: 5×800m" }),
      run("cd", 1.0, "8:30", { title: "Cooldown — Track: 5×800m" }),
      run("ride", 40, "3:02", { type: "cross_training" }),
      run("open", 0, "0:00", { completed: false }),
      { ...run("nodist", 1, "7:00"), actualDistance: undefined },
    ];
    expect(weekRuns(rows).map((r) => r._id)).toEqual(["main"]);
  });

  it("counts a relabelled run by its original running type", () => {
    const rows = [run("relabel", 5, "7:00", { type: "rest", originalType: "run" })];
    expect(weekRuns(rows)).toHaveLength(1);
  });
});

describe("slotWeekStats", () => {
  it("plans from required slots and reads quality from its fill", () => {
    const slots: Slot[] = [
      slot({ id: "long", kind: "long", targetDistance: 11 }),
      slot({ id: "q1", kind: "quality", title: "Track: 5×800m", targetDistance: 8 }),
      slot({ id: "easy", kind: "easy", optional: true, targetDistance: 5 }),
    ];
    const track = { ...run("track", 8, "6:22"), actualPace: "6:22/km" };
    expect(slotWeekStats(slots, { long: null, q1: track, easy: null })).toEqual({
      runsPlanned: 2,
      plannedKm: 19,
      qualityTitle: "Track: 5×800m",
      qualityCompleted: true,
      qualityPace: "6:22/km",
    });
  });

  it("leaves skipped slots out of the plan", () => {
    const slots: Slot[] = [slot({ id: "q1", kind: "quality", skipped: true, targetDistance: 8 })];
    expect(slotWeekStats(slots, { q1: null })).toEqual({
      runsPlanned: 0,
      plannedKm: 0,
      qualityTitle: undefined,
      qualityCompleted: false,
      qualityPace: undefined,
    });
  });
});
