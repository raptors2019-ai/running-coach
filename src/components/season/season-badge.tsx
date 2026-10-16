"use client";

import { useQuery } from "convex/react";
import { Snowflake } from "lucide-react";
import { api } from "../../../convex/_generated/api";

/** "Base · Wk 1 of 9": stands in for the race countdown while a season runs. */
export function SeasonBadge() {
  const active = useQuery(api.seasons.getActiveSeason);
  if (!active?.phase) return null;
  const { phase } = active;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-winter-ice px-3 py-1.5 text-xs font-semibold text-winter-navy">
      <Snowflake className="h-3.5 w-3.5 text-slot-long" aria-hidden="true" />
      {phase.phase.name} · Wk {phase.weekInPhase} of {phase.weeksInPhase}
    </span>
  );
}
