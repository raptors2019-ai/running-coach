import { format, parseISO } from "date-fns";
import { Flag } from "lucide-react";
import { formatDuration } from "@/lib/pace-utils";
import type { ActiveSeason } from "./types";

const short = (seconds: number) => formatDuration(seconds).replace(/:00$/, "");

/** The season's time trials as badges: 5K in sunrise, 10K in blue, goal efforts flagged. */
export function CheckpointTrail({ active }: { active: ActiveSeason }) {
  const checkpoints = [...active.season.checkpoints].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ol className="flex justify-between rounded-[18px] bg-white px-2.5 py-3.5">
      {checkpoints.map((c) => {
        const tenK = c.distanceKm >= 10;
        const past = c.date < active.today;
        const solid = tenK ? "bg-slot-long" : "bg-sunrise";
        const soft = tenK ? "bg-slot-long-soft border-slot-long text-slot-long-ink" : "bg-sunrise-soft border-sunrise text-[#8a3210]";
        const aim = c.resultSeconds ?? c.aimSeconds;
        return (
          <li key={c.date} className={`flex w-[62px] flex-col items-center gap-1 ${past ? "opacity-60" : ""}`}>
            {c.isGoal ? (
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${solid}`}>
                <Flag className={`h-[18px] w-[18px] ${tenK ? "text-white" : "text-sunrise-ink"}`} aria-hidden="true" />
              </span>
            ) : (
              <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-extrabold ${soft}`}>
                {c.distanceKm}K
              </span>
            )}
            <span className="text-[11px] font-bold text-winter-ink">{format(parseISO(c.date), "MMM d")}</span>
            <span className={`text-[10px] ${c.isGoal ? "font-bold text-winter-ink" : "text-winter-muted"}`}>
              {aim ? (c.isGoal && !c.resultSeconds ? `sub-${short(aim)}` : `${c.resultSeconds ? "" : "~"}${short(aim)}`) : c.label}
            </span>
            <span className="sr-only">{c.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
