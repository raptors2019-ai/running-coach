import { format, parseISO } from "date-fns";
import type { Slot } from "../../../convex/lib/slots";

export type DraftKind = "skip" | "push" | "swap";

/**
 * Plan changes from the slot sheet go to the coach as an editable message,
 * never applied silently — the athlete tweaks the wording, the coach
 * rebalances and says what it changed.
 */
export function coachDraft(kind: DraftKind, slot: Slot, weekStart: string): string {
  const week = format(parseISO(weekStart), "MMM d");
  switch (kind) {
    case "skip":
      return `Skip "${slot.title}" this week (week of ${week}) — rebalance the rest if it needs it.`;
    case "push":
      return `Push "${slot.title}" to next week (from the week of ${week}) and adjust next week around it.`;
    case "swap":
      return `Can we swap "${slot.title}" (week of ${week}) for something else? I'm thinking `;
  }
}

export function coachHref(text: string): string {
  return `/coach?draft=${encodeURIComponent(text)}`;
}
