import { slotStyle, repBars, toGoLabel, slotTarget } from "./slot-style";
import type { Slot } from "../../../convex/lib/slots";

const slot = (over: Partial<Slot> & Pick<Slot, "id" | "kind">): Slot => ({
  type: over.kind,
  title: over.id,
  description: "",
  optional: false,
  ...over,
});

describe("slotStyle", () => {
  it("marks a filled slot done with its day", () => {
    const s = slotStyle(slot({ id: "long", kind: "long" }), { dayOfWeek: "Monday" }, false);
    expect(s).toMatchObject({ tone: "done", icon: "mountain", badge: "DONE · MON" });
  });

  it("marks the up-next quality slot with a bolt", () => {
    expect(slotStyle(slot({ id: "q1", kind: "quality" }), null, true)).toMatchObject({
      tone: "next",
      icon: "bolt",
      badge: "UP NEXT",
    });
  });

  it("marks an open optional easy slot as a bonus", () => {
    expect(slotStyle(slot({ id: "easy", kind: "easy", optional: true }), null, false)).toMatchObject({
      tone: "bonus",
      icon: "leaf",
      badge: "BONUS",
    });
  });

  it("marks a skipped slot skipped even if it is next in line", () => {
    expect(slotStyle(slot({ id: "q1", kind: "quality", skipped: true }), null, true).tone).toBe("skipped");
  });

  it("leaves an open required slot that isn't next as open", () => {
    expect(slotStyle(slot({ id: "long", kind: "long" }), null, false)).toMatchObject({ tone: "open", badge: "TO DO" });
  });
});

describe("repBars", () => {
  it("draws one bar per rep from the first interval set", () => {
    const s = slot({ id: "q1", kind: "quality", intervals: [{ distance: "800m", pace: "3:45", rest: "2:00", reps: 5 }] });
    expect(repBars(s)).toBe(5);
  });
  it("is 0 without intervals and caps at 12", () => {
    expect(repBars(slot({ id: "l", kind: "long" }))).toBe(0);
    const many = slot({ id: "q", kind: "quality", intervals: [{ distance: "200m", pace: "", rest: "", reps: 20 }] });
    expect(repBars(many)).toBe(12);
  });
});

describe("toGoLabel", () => {
  it("gives a range while required runs remain", () => {
    expect(toGoLabel(1, 2, 3)).toBe("1–2 to go");
  });
  it("drops the range when every slot is required", () => {
    expect(toGoLabel(0, 2, 2)).toBe("2 to go");
  });
  it("talks about bonus runs once required ones are done", () => {
    expect(toGoLabel(2, 2, 3)).toBe("1 bonus run left");
  });
  it("calls the week done when everything is filled", () => {
    expect(toGoLabel(3, 2, 3)).toBe("Week done");
  });
});

describe("slotTarget", () => {
  it("describes an interval slot by its reps", () => {
    const s = slot({
      id: "q1",
      kind: "quality",
      targetDistance: 8,
      intervals: [{ distance: "800m", pace: "3:45-3:50", rest: "2:00 jog", reps: 5 }],
    });
    expect(slotTarget(s)).toBe("3:45-3:50 per rep · 2:00 jog · ~8 km");
  });
  it("describes a steady slot by distance and pace", () => {
    expect(slotTarget(slot({ id: "l", kind: "long", targetDistance: 11, targetPace: "6:45-7:15" }))).toBe("11 km @ 6:45-7:15");
  });
  it("falls back to the description", () => {
    expect(slotTarget(slot({ id: "e", kind: "easy", description: "whatever feels good" }))).toBe("whatever feels good");
  });
});
