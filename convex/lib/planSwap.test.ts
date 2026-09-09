import { swapPlanPatches } from "./planSwap";

const intervalsRow = {
  date: "2026-09-08",
  dayOfWeek: "Tue",
  completed: true,
  actualDistance: 3.42,
  actualDuration: 1561,
  actualPace: "7:36/km",
  stravaActivityId: "20095398541",
  originalType: "intervals",
  type: "run",
  title: "VO2max: 5x800m",
  description: "WU 1.5km + 5x800m",
  targetDistance: 7,
  targetPace: "4:50-5:00",
  intervals: [{ distance: "800m", pace: "4:50-5:00/km", rest: "2:30 jog", reps: 5 }],
};

const partnerRow = {
  date: "2026-09-12",
  dayOfWeek: "Sat",
  completed: false,
  missedAt: 1788775210035,
  type: "easy",
  title: "Partner Easy Run",
  description: "2-3km conversational",
  targetDistance: 2.5,
  targetPace: "7:00+",
};

describe("swapPlanPatches", () => {
  it("gives each row the other's plan fields", () => {
    const [patchA, patchB] = swapPlanPatches(intervalsRow, partnerRow);
    expect(patchA).toMatchObject({ type: "easy", title: "Partner Easy Run", targetDistance: 2.5, targetPace: "7:00+" });
    expect(patchB).toMatchObject({ type: "intervals", title: "VO2max: 5x800m", targetDistance: 7, targetPace: "4:50-5:00" });
    expect(patchB.intervals).toEqual(intervalsRow.intervals);
  });

  it("clears plan fields the other row does not have", () => {
    const [patchA] = swapPlanPatches(intervalsRow, partnerRow);
    expect("intervals" in patchA).toBe(true);
    expect(patchA.intervals).toBeUndefined();
  });

  it("leaves date, completion and actuals where they are", () => {
    const [patchA, patchB] = swapPlanPatches(intervalsRow, partnerRow);
    for (const patch of [patchA, patchB]) {
      for (const key of ["date", "dayOfWeek", "weekNumber", "completed", "actualDistance", "actualDuration", "actualPace", "avgHeartRate", "stravaActivityId", "notes"]) {
        expect(key in patch).toBe(false);
      }
    }
  });

  it("clears a sync type override and the missed flag on both rows", () => {
    const [patchA, patchB] = swapPlanPatches(intervalsRow, partnerRow);
    expect("originalType" in patchA && patchA.originalType === undefined).toBe(true);
    expect("missedAt" in patchB && patchB.missedAt === undefined).toBe(true);
  });

  it("restores the sync-overridden type when swapping a plan back onto its own row", () => {
    // The completed row's plan type is what was planned (originalType), not
    // what the sync relabelled it to — that is what travels to the other row.
    const [, patchB] = swapPlanPatches(intervalsRow, partnerRow);
    expect(patchB.type).toBe("intervals");
  });
});
