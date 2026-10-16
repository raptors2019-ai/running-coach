import type { Slot } from "../../../convex/lib/slots";

export type SlotTone = "done" | "next" | "open" | "bonus" | "skipped";
export type SlotIcon = "mountain" | "bolt" | "leaf" | "check";

const KIND_ICON: Record<Slot["kind"], SlotIcon> = { long: "mountain", quality: "bolt", easy: "leaf" };

/** How a slot tile reads: its state, icon and the little badge in its corner. */
export function slotStyle(
  slot: Slot,
  fill: { dayOfWeek: string } | null,
  isUpNext: boolean
): { tone: SlotTone; icon: SlotIcon; badge: string } {
  const icon = KIND_ICON[slot.kind];
  if (slot.skipped) return { tone: "skipped", icon, badge: "SKIPPED" };
  if (fill) return { tone: "done", icon, badge: `DONE · ${fill.dayOfWeek.slice(0, 3).toUpperCase()}` };
  if (isUpNext) return { tone: "next", icon, badge: "UP NEXT" };
  if (slot.optional) return { tone: "bonus", icon, badge: "BONUS" };
  return { tone: "open", icon, badge: "TO DO" };
}

/** Rep bars for an interval slot: one per rep of the first set, capped so they stay legible. */
export function repBars(slot: Slot): number {
  return Math.min(12, slot.intervals?.[0]?.reps ?? 0);
}

/** "3:45-3:50 per rep · 2:00 jog · ~8 km", or "11 km @ 6:45-7:15". */
export function slotTarget(slot: Slot): string {
  const set = slot.intervals?.[0];
  const km = slot.targetDistance ? `~${slot.targetDistance} km` : null;
  if (set) return [`${set.pace} per rep`, set.rest, km].filter(Boolean).join(" · ");
  return [slot.targetDistance ? `${slot.targetDistance} km` : null, slot.targetPace ? `@ ${slot.targetPace}` : null]
    .filter(Boolean)
    .join(" ") || slot.description;
}

/** "1–2 to go", "1 bonus run left", "Week done". */
export function toGoLabel(done: number, required: number, total: number): string {
  if (done >= total) return "Week done";
  if (done >= required) return `${total - done} bonus run${total - done === 1 ? "" : "s"} left`;
  const min = required - done;
  const max = total - done;
  return min === max ? `${min} to go` : `${min}–${max} to go`;
}
