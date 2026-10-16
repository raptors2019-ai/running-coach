"use client";

import { useState } from "react";
import { SlotSheet } from "./slot-sheet";
import type { SeasonWeek, WeekRun } from "./types";

/** Which slot's sheet is open, plus the sheet itself, for any view that lists a week's slots. */
export function useSlotSheet(week: SeasonWeek | undefined) {
  const [openId, setOpenId] = useState<string | null>(null);
  const slot = week?.slots.find((s) => s.id === openId) ?? null;
  const runs: WeekRun[] = week
    ? [...Object.values(week.fills).filter((r): r is WeekRun => r !== null), ...week.extras].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    : [];
  const sheet =
    week && slot ? (
      <SlotSheet
        key={slot.id}
        open
        onOpenChange={(o) => !o && setOpenId(null)}
        slot={slot}
        fill={week.fills[slot.id] ?? null}
        weekStart={week.weekStart}
        runs={runs}
      />
    ) : null;
  return { open: setOpenId, sheet };
}
