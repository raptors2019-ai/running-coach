import { weekForPrompt, slotInputToSlot } from "./seasonPrompt";

describe("weekForPrompt", () => {
  it("shows each slot with what filled it, plus extras and cross-training", () => {
    const out = weekForPrompt({
      weekStart: "2026-10-12",
      plan: { status: "set", note: "Base week 1" },
      slots: [
        { id: "long", kind: "long", type: "long", title: "Long run", description: "10-12 km easy", targetDistance: 11, optional: false },
        { id: "q1", kind: "quality", type: "intervals", title: "Track: 5×800m", description: "", optional: false, pinnedWorkoutId: "w9" },
        { id: "easy", kind: "easy", type: "easy", title: "Easy run", description: "", optional: true, skipped: true },
      ],
      fills: {
        long: { date: "2026-10-12", dayOfWeek: "Monday", actualDistance: 15.07, actualPace: "7:11/km", avgHeartRate: 144 },
        q1: null,
        easy: null,
      },
      extras: [{ date: "2026-10-14", dayOfWeek: "Wednesday", actualDistance: 3, actualPace: "7:30/km" }],
      crossTraining: [{ type: "cross_training", title: "Afternoon Ride", actualDistance: 40.05 }],
      totals: { runKm: 18.1, runs: 2, crossCount: 1 },
    });
    expect(out.status).toBe("set");
    expect(out.note).toBe("Base week 1");
    expect(out.slots[0]).toMatchObject({
      id: "long",
      kind: "long",
      filledBy: { date: "2026-10-12", day: "Monday", km: 15.07, pace: "7:11/km", hr: 144 },
    });
    expect(out.slots[1]).toMatchObject({ id: "q1", filledBy: null, pinned: true });
    expect(out.slots[2]).toMatchObject({ id: "easy", skipped: true });
    expect(out.extraRuns).toEqual([{ date: "2026-10-14", day: "Wednesday", km: 3, pace: "7:30/km", hr: undefined }]);
    expect(out.crossTraining).toEqual(["Afternoon Ride 40.05 km"]);
    expect(out.totals).toEqual({ runKm: 18.1, runs: 2, crossCount: 1 });
  });

  it("says when the coach hasn't planned the week", () => {
    const out = weekForPrompt({ weekStart: "2026-10-19", plan: null, slots: [], fills: {}, extras: [], crossTraining: [], totals: { runKm: 0, runs: 0, crossCount: 0 } });
    expect(out.status).toBe("not planned yet");
  });
});

describe("slotInputToSlot", () => {
  it("maps the tool's snake_case slot onto the stored shape", () => {
    expect(
      slotInputToSlot({
        id: "q1",
        kind: "quality",
        type: "intervals",
        title: "Track",
        description: "5x800",
        target_distance: 8,
        target_pace: "3:45-3:50 per 800m",
        intervals: [{ distance: "800m", pace: "3:45-3:50", rest: "2:00 jog", reps: 5 }],
        optional: false,
      })
    ).toEqual({
      id: "q1",
      kind: "quality",
      type: "intervals",
      title: "Track",
      description: "5x800",
      targetDistance: 8,
      targetPace: "3:45-3:50 per 800m",
      intervals: [{ distance: "800m", pace: "3:45-3:50", rest: "2:00 jog", reps: 5 }],
      optional: false,
      skipped: undefined,
    });
  });

  it("defaults optional to false and drops unknown kinds", () => {
    expect(slotInputToSlot({ id: "e", kind: "easy", type: "easy", title: "E", description: "" }).optional).toBe(false);
    expect(() => slotInputToSlot({ id: "x", kind: "tempo", type: "tempo", title: "T", description: "" })).toThrow(/kind/);
  });
});
