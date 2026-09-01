import { canCountRunAsPlanned, makeUpCandidates, shortDate, MakeUpWorkout } from "./makeUp";

const row = (over: Partial<MakeUpWorkout>): MakeUpWorkout => ({
  _id: over._id ?? Math.random().toString(36).slice(2),
  planId: "plan1",
  date: "2026-08-30",
  type: "long",
  title: "Long Run",
  completed: false,
  ...over,
});

const sundayLong = row({ _id: "sun", date: "2026-08-30", type: "long", missedAt: 1 });
const mondayRun = row({
  _id: "mon",
  date: "2026-08-31",
  type: "run",
  title: "Run",
  completed: true,
  isUnplanned: true,
  actualDistance: 5.01,
});

describe("canCountRunAsPlanned", () => {
  it("lets an unplanned run stand in for a missed planned run", () => {
    expect(canCountRunAsPlanned(sundayLong, mondayRun)).toBe(true);
  });
  it("also allows a run done early", () => {
    const tue = row({ date: "2026-09-01", type: "intervals" });
    expect(canCountRunAsPlanned(tue, mondayRun)).toBe(true);
  });
  it("rejects planned rows that are already done or aren't runs", () => {
    expect(canCountRunAsPlanned(row({ completed: true }), mondayRun)).toBe(false);
    expect(canCountRunAsPlanned(row({ type: "upper_body" }), mondayRun)).toBe(false);
    expect(canCountRunAsPlanned(row({ isUnplanned: true }), mondayRun)).toBe(false);
  });
  it("rejects runs that aren't extras, aren't runs, or are session segments", () => {
    expect(canCountRunAsPlanned(sundayLong, row({ ...mondayRun, isUnplanned: false }))).toBe(false);
    expect(canCountRunAsPlanned(sundayLong, row({ ...mondayRun, type: "cross_training" }))).toBe(false);
    expect(canCountRunAsPlanned(sundayLong, row({ ...mondayRun, title: "Warmup — Intervals" }))).toBe(false);
  });
  it("only pairs within a week and within the same plan", () => {
    expect(canCountRunAsPlanned(row({ date: "2026-08-23" }), mondayRun)).toBe(false);
    expect(canCountRunAsPlanned(row({ date: "2026-08-24" }), mondayRun)).toBe(true);
    expect(canCountRunAsPlanned(row({ planId: "old" }), mondayRun)).toBe(false);
  });
});

describe("makeUpCandidates", () => {
  const all = [
    sundayLong,
    mondayRun,
    row({ _id: "sat", date: "2026-08-29", type: "easy", missedAt: 1 }),
    row({ _id: "tue", date: "2026-09-01", type: "intervals" }),
    row({ _id: "lift", date: "2026-08-31", type: "upper_body", completed: true }),
  ];
  it("lists planned runs an extra run could cover, closest first", () => {
    expect(makeUpCandidates(mondayRun, all).map((w) => w._id)).toEqual(["sun", "tue", "sat"]);
  });
  it("lists extra runs that could cover a planned run", () => {
    expect(makeUpCandidates(sundayLong, all).map((w) => w._id)).toEqual(["mon"]);
  });
});

describe("shortDate", () => {
  it("formats for notes", () => {
    expect(shortDate("2026-08-31")).toBe("Mon, Aug 31");
  });
});
