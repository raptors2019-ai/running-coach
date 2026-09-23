import { dayKind, dailyRoutine, DRILLS } from "./breathwork";

describe("dayKind", () => {
  it("reads the planned type, not Strava's relabel", () => {
    expect(dayKind({ type: "run", originalType: "intervals" })).toBe("hard");
  });

  it("classifies each kind of day", () => {
    expect(dayKind({ type: "race_pace" })).toBe("hard");
    expect(dayKind({ type: "tempo" })).toBe("hard");
    expect(dayKind({ type: "race" })).toBe("race");
    expect(dayKind({ type: "long" })).toBe("easy");
    expect(dayKind({ type: "shakeout" })).toBe("easy");
    expect(dayKind({ type: "lower_body" })).toBe("off");
    expect(dayKind({ type: "rest" })).toBe("off");
    expect(dayKind(null)).toBe("off");
  });
});

describe("dailyRoutine", () => {
  it.each(["off", "easy", "hard", "race"] as const)("is 15 dedicated minutes on a %s day", (kind) => {
    expect(dailyRoutine(kind).dedicatedMinutes).toBe(15);
  });

  it("always starts with the morning drill and every block points at a real drill", () => {
    for (const kind of ["off", "easy", "hard", "race"] as const) {
      const { blocks } = dailyRoutine(kind);
      expect(blocks[0].drill).toBe("wake");
      for (const b of blocks) expect(DRILLS[b.drill]).toBeDefined();
    }
  });

  it("puts the primer before hard efforts only", () => {
    const has = (kind: "off" | "easy" | "hard" | "race") =>
      dailyRoutine(kind).blocks.some((b) => b.drill === "primer");
    expect(has("hard")).toBe(true);
    expect(has("race")).toBe(true);
    expect(has("easy")).toBe(false);
    expect(has("off")).toBe(false);
  });
});
