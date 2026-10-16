import {
  findActiveSeason,
  mondayOf,
  seasonWeekIndex,
  phaseFor,
  seasonProgress,
  nextCheckpoint,
  slotProgress,
  upNextSlot,
  type SeasonLike,
} from "./season";
import type { Slot } from "./slots";

export const WINTER: SeasonLike = {
  startDate: "2026-10-12",
  endDate: "2027-06-13",
  goals: [
    { label: "10K", distanceKm: 10, targetSeconds: 3000, byDate: "2027-04-11" },
    { label: "5K", distanceKm: 5, targetSeconds: 1200, byDate: "2027-06-13" },
  ],
  phases: [
    { key: "base", name: "Base", startDate: "2026-10-12", endDate: "2026-12-13", focus: "" },
    { key: "10k_build", name: "10K build", startDate: "2026-12-14", endDate: "2027-04-11", focus: "" },
    { key: "5k_speed", name: "5K speed", startDate: "2027-04-12", endDate: "2027-06-13", focus: "" },
  ],
  checkpoints: [
    { date: "2026-12-12", label: "5K time trial", distanceKm: 5, aimSeconds: 1380, isGoal: false },
    { date: "2027-02-13", label: "10K time trial", distanceKm: 10, aimSeconds: 3120, isGoal: false },
  ],
};

const slot = (id: string, kind: Slot["kind"], optional = false): Slot => ({
  id, kind, type: kind, title: id, description: "", optional,
});

describe("findActiveSeason", () => {
  it("finds the season containing today", () => {
    expect(findActiveSeason([WINTER], "2026-10-15")).toBe(WINTER);
  });
  it("returns null before the start and after the end", () => {
    expect(findActiveSeason([WINTER], "2026-10-11")).toBeNull();
    expect(findActiveSeason([WINTER], "2027-06-14")).toBeNull();
  });
});

describe("week and phase", () => {
  it("knows Oct 15 is week 1, Base week 1 of 9", () => {
    expect(mondayOf("2026-10-15")).toBe("2026-10-12");
    expect(seasonWeekIndex(WINTER, "2026-10-15")).toBe(1);
    const p = phaseFor(WINTER, "2026-10-15");
    expect(p?.phase.name).toBe("Base");
    expect(p?.weekInPhase).toBe(1);
    expect(p?.weeksInPhase).toBe(9);
  });
  it("switches phase at the boundary", () => {
    expect(phaseFor(WINTER, "2026-12-13")?.phase.key).toBe("base");
    const build = phaseFor(WINTER, "2026-12-14");
    expect(build?.phase.key).toBe("10k_build");
    expect(build?.index).toBe(1);
    expect(build?.weekInPhase).toBe(1);
    expect(build?.weeksInPhase).toBe(17);
  });
  it("clamps season progress to 0..1", () => {
    expect(seasonProgress(WINTER, "2026-10-12")).toBe(0);
    expect(seasonProgress(WINTER, "2028-01-01")).toBe(1);
    expect(seasonProgress(WINTER, "2027-02-11")).toBeCloseTo(0.5, 1);
  });
});

describe("nextCheckpoint", () => {
  it("is the Dec 12 5K, 58 days from Oct 15", () => {
    const next = nextCheckpoint(WINTER, "2026-10-15");
    expect(next?.checkpoint.date).toBe("2026-12-12");
    expect(next?.daysAway).toBe(58);
  });
  it("counts a checkpoint today as 0 days away", () => {
    expect(nextCheckpoint(WINTER, "2026-12-12")?.daysAway).toBe(0);
  });
  it("is null after the last checkpoint", () => {
    expect(nextCheckpoint(WINTER, "2027-03-01")).toBeNull();
  });
});

describe("slotProgress and upNextSlot", () => {
  const slots = [slot("long", "long"), slot("q1", "quality"), slot("easy", "easy", true)];
  it("reads 1 of 2–3 with one required slot filled", () => {
    const p = slotProgress(slots, { long: { _id: "r" }, q1: null, easy: null });
    expect(p).toEqual({ done: 1, required: 2, total: 3, label: "1 of 2–3" });
  });
  it("drops the range when every slot is required", () => {
    expect(slotProgress(slots.slice(0, 2), { long: null, q1: null }).label).toBe("0 of 2");
  });
  it("ignores skipped slots", () => {
    const withSkip = [slots[0], { ...slots[1], skipped: true }, slots[2]];
    expect(slotProgress(withSkip, { long: null, q1: null, easy: null }).label).toBe("0 of 1–2");
  });
  it("picks the open quality slot as up next", () => {
    expect(upNextSlot(slots, { long: { _id: "r" }, q1: null, easy: null })?.id).toBe("q1");
  });
  it("falls back to an optional slot once required ones are done", () => {
    expect(upNextSlot(slots, { long: { _id: "a" }, q1: { _id: "b" }, easy: null })?.id).toBe("easy");
  });
  it("is null when everything is filled", () => {
    expect(upNextSlot(slots, { long: { _id: "a" }, q1: { _id: "b" }, easy: { _id: "c" } })).toBeNull();
  });
});
