import { coachDraft, coachHref } from "./coach-drafts";
import type { Slot } from "../../../convex/lib/slots";

const track: Slot = { id: "q1", kind: "quality", type: "intervals", title: "Track: 5×800m", description: "", optional: false };

describe("coachDraft", () => {
  it("asks to skip the slot this week", () => {
    expect(coachDraft("skip", track, "2026-10-12")).toBe(
      'Skip "Track: 5×800m" this week (week of Oct 12) — rebalance the rest if it needs it.'
    );
  });
  it("asks to push the slot to next week", () => {
    expect(coachDraft("push", track, "2026-10-12")).toBe(
      'Push "Track: 5×800m" to next week (from the week of Oct 12) and adjust next week around it.'
    );
  });
  it("asks for a swap", () => {
    const text = coachDraft("swap", track, "2026-10-12");
    expect(text).toContain("Track: 5×800m");
    expect(text).toContain("week of Oct 12");
  });
});

describe("coachHref", () => {
  it("encodes the draft into the coach page's draft param", () => {
    expect(coachHref('Skip "A" & B?')).toBe("/coach?draft=Skip%20%22A%22%20%26%20B%3F");
  });
});
