import { format, parseISO } from "date-fns";
import { formatDuration } from "@/lib/pace-utils";
import type { ActiveSeason } from "./types";

/** A ticket counting down to the next time trial, with the phase's weeks as a strip. */
export function NextCheckpointCard({ active }: { active: ActiveSeason }) {
  const next = active.nextCheckpoint;
  if (!next) return null;
  const { checkpoint, daysAway } = next;
  const aim = checkpoint.aimSeconds ? formatDuration(checkpoint.aimSeconds).replace(/:00$/, "") : null;
  const phase = active.phase;
  return (
    <section className="flex items-center gap-3.5 rounded-[20px] bg-white p-3.5">
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-sunrise text-sunrise-ink">
        <span className="font-display text-2xl leading-none font-extrabold">{daysAway}</span>
        <span className="text-[10px] font-bold">{daysAway === 1 ? "DAY" : "DAYS"}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold text-winter-ink">
          {checkpoint.label} · {format(parseISO(checkpoint.date), "MMM d")}
        </span>
        <span className="text-xs text-winter-muted">
          {checkpoint.isGoal ? "Goal effort" : "Checkpoint"}
          {aim ? ` · aim ${checkpoint.isGoal ? "sub-" : "~"}${aim}` : ""}
        </span>
        {phase && (
          <div className="mt-0.5 flex gap-[3px]" aria-label={`${phase.phase.name} week ${phase.weekInPhase} of ${phase.weeksInPhase}`}>
            {Array.from({ length: phase.weeksInPhase }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < phase.weekInPhase ? "bg-sunrise" : "bg-[#e3e7f5]"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
