import { substitutionOptions, substitutionMessage, plannedTitle } from "./substitution";

const row = (over: Record<string, unknown>) => ({
  _id: "x",
  date: "2026-09-10",
  title: "Zone 2 Run",
  type: "easy",
  completed: false,
  ...over,
});

describe("substitutionOptions", () => {
  const current = row({ _id: "cur", date: "2026-09-08", title: "VO2max: 5x800m", type: "intervals", completed: true });
  it("offers the week's other open planned workouts", () => {
    const partner = row({ _id: "p", date: "2026-09-12", title: "Partner Easy Run" });
    expect(substitutionOptions([current, partner], current).map((w) => w._id)).toEqual(["p"]);
  });
  it("leaves out the current row, completed days and unplanned Strava rows", () => {
    const done = row({ _id: "d", completed: true });
    const unplanned = row({ _id: "u", isUnplanned: true, completed: true });
    expect(substitutionOptions([current, done, unplanned], current)).toEqual([]);
  });
  it("lists options in date order", () => {
    const sun = row({ _id: "sun", date: "2026-09-13" });
    const thu = row({ _id: "thu", date: "2026-09-10" });
    expect(substitutionOptions([sun, current, thu], current).map((w) => w._id)).toEqual(["thu", "sun"]);
  });
});

describe("substitutionMessage", () => {
  it("tells the coach what was done instead of what, and asks for a rebalance", () => {
    expect(
      substitutionMessage({ date: "2026-09-08", did: "Partner Easy Run", insteadOf: "VO2max: 5x800m" })
    ).toBe("I did Partner Easy Run on Tue Sep 8 instead of VO2max: 5x800m. Rebalance the rest of the week and tell me what you changed.");
  });
});

describe("plannedTitle", () => {
  it("uses the row's title when the sync did not relabel it", () => {
    expect(plannedTitle({ title: "Partner Easy Run" })).toBe("Partner Easy Run");
  });
  it("recovers the originally planned title from a sync relabel note", () => {
    expect(
      plannedTitle({ title: "Cross Training", originalType: "easy", notes: "Originally planned: Partner Easy Run. Did: Morning Ride" })
    ).toBe("Partner Easy Run");
  });
});
