import { workoutUpdatePatch } from "./workoutUpdate";

describe("workoutUpdatePatch", () => {
  it("only includes fields the coach sent", () => {
    expect(workoutUpdatePatch({ description: "new", targetPace: undefined })).toEqual({ description: "new" });
  });

  it("replaces the rep table when intervals are sent", () => {
    const intervals = [{ distance: "400m", pace: "4:40-4:45/km", rest: "full recovery", reps: 3 }];
    expect(workoutUpdatePatch({ targetPace: "4:40-4:45", intervals })).toEqual({
      targetPace: "4:40-4:45",
      intervals,
    });
  });

  it("clears the rep table when an empty list is sent", () => {
    const patch = workoutUpdatePatch({ intervals: [] });
    expect("intervals" in patch).toBe(true);
    expect(patch.intervals).toBeUndefined();
  });

  it("leaves the rep table alone when intervals are omitted", () => {
    expect("intervals" in workoutUpdatePatch({ title: "Sharpener" })).toBe(false);
  });
});
