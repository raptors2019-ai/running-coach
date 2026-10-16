import { groupCrossTraining } from "./cross-training";

describe("groupCrossTraining", () => {
  it("groups rides by km, lifts and hoops by count", () => {
    const groups = groupCrossTraining([
      { type: "cross_training", title: "Afternoon Ride", actualDistance: 40.05 },
      { type: "cross_training", title: "Night Basketball" },
      { type: "cross_training", title: "Afternoon Weight Training", actualDistance: 0 },
      { type: "upper_body", title: "Upper Body" },
      { type: "cross_training", title: "Lunch Weight Training" },
    ]);
    expect(groups.map((g) => [g.kind, g.text])).toEqual([
      ["ride", "Ride 40 km"],
      ["hoops", "Hoops"],
      ["lift", "Lifts ×3"],
    ]);
  });
  it("labels unknown activities as other", () => {
    expect(groupCrossTraining([{ type: "cross_training", title: "Evening Physical Therapy" }])[0].kind).toBe("other");
  });
});
