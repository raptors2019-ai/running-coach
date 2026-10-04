/**
 * Timing for the sticker pop-in, shared by the live SVG animation, the
 * in-app video recorder and the offline frame renderer so they all agree
 * on when each run appears.
 */

export const LEAD_IN_SECONDS = 0.4; // empty frame before the first sticker
export const POP_SECONDS = 0.5; // one sticker's pop
export const TOTALS_GAP_SECONDS = 0.35; // pause before the totals card
export const HOLD_SECONDS = 2.5; // finished frame held at the end

export function popStaggerSeconds(count: number): number {
  return count <= 1 ? 0 : Math.min(0.3, 5 / count);
}

export interface StickerTimeline {
  stagger: number;
  /** When sticker i starts popping. */
  startOf: (index: number) => number;
  /** When the totals card starts, or null without one. */
  totalsAt: number | null;
  /** Length of the whole clip including the hold. */
  end: number;
}

export function stickerTimeline(count: number, withTotals: boolean): StickerTimeline {
  const stagger = popStaggerSeconds(count);
  const startOf = (index: number) => LEAD_IN_SECONDS + index * stagger;
  const lastDone = count === 0 ? LEAD_IN_SECONDS : startOf(count - 1) + POP_SECONDS;
  const totalsAt = withTotals ? lastDone + TOTALS_GAP_SECONDS : null;
  const end = (totalsAt === null ? lastDone : totalsAt + POP_SECONDS) + HOLD_SECONDS;
  return { stagger, startOf, totalsAt, end };
}

/** Ease-out with a little overshoot, like the CSS pop. */
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export interface PopState {
  opacity: number; // 0..1
  scale: number; // factor applied on top of the sticker's own scale
}

/** How far a sticker that starts at `start` has popped at time `t`. */
export function popState(t: number, start: number): PopState {
  const x = Math.min(1, Math.max(0, (t - start) / POP_SECONDS));
  if (x <= 0) return { opacity: 0, scale: 0.6 };
  if (x >= 1) return { opacity: 1, scale: 1 };
  const e = easeOutBack(x);
  return { opacity: Math.min(1, x * 2), scale: 0.6 + 0.4 * e };
}
