import {
  HOLD_SECONDS,
  LEAD_IN_SECONDS,
  POP_SECONDS,
  TOTALS_GAP_SECONDS,
  popState,
  stickerTimeline,
} from "./sticker-timeline";

describe("sticker timeline", () => {
  it("spaces stickers out and ends after the hold", () => {
    const tl = stickerTimeline(10, true);
    expect(tl.startOf(0)).toBe(LEAD_IN_SECONDS);
    expect(tl.startOf(1) - tl.startOf(0)).toBeCloseTo(tl.stagger);
    const lastDone = tl.startOf(9) + POP_SECONDS;
    expect(tl.totalsAt).toBeCloseTo(lastDone + TOTALS_GAP_SECONDS);
    expect(tl.end).toBeCloseTo(tl.totalsAt! + POP_SECONDS + HOLD_SECONDS);
  });

  it("skips the totals when there is no card", () => {
    const tl = stickerTimeline(3, false);
    expect(tl.totalsAt).toBeNull();
    expect(tl.end).toBeCloseTo(tl.startOf(2) + POP_SECONDS + HOLD_SECONDS);
  });

  it("caps the stagger so a busy month still fits", () => {
    expect(stickerTimeline(60, false).stagger).toBeLessThan(stickerTimeline(10, false).stagger);
    expect(stickerTimeline(1, false).stagger).toBe(0);
  });

  it("pops from invisible to settled with an overshoot in between", () => {
    expect(popState(0, 1)).toEqual({ opacity: 0, scale: 0.6 });
    expect(popState(5, 1)).toEqual({ opacity: 1, scale: 1 });
    const mid = popState(1 + POP_SECONDS * 0.7, 1);
    expect(mid.opacity).toBe(1);
    expect(mid.scale).toBeGreaterThan(1); // overshoot
  });
});
