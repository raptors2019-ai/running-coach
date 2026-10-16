import { Gauge, Leaf, Mountain, Zap } from "lucide-react";
import { slotTarget } from "./slot-style";
import type { SeasonWeek } from "./types";

const TONES = {
  tempo: { box: "bg-sun-soft", ink: "text-sun-ink", Icon: Gauge },
  intervals: { box: "bg-slot-quality-soft", ink: "text-slot-quality-ink", Icon: Zap },
  long: { box: "bg-slot-long-soft", ink: "text-slot-long-ink", Icon: Mountain },
  easy: { box: "bg-white border-2 border-dashed border-winter-line", ink: "text-winter-muted", Icon: Leaf },
} as const;

/** Next week's slots as compact tiles; a draft until the coach locks it in Monday. */
export function NextWeek({ week }: { week: SeasonWeek }) {
  if (!week.plan) {
    return <p className="text-[13px] text-winter-muted">The coach plans it on Monday, from what you actually ran.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {week.slots.map((s) => {
          const tone =
            s.kind === "easy" || s.optional
              ? TONES.easy
              : s.kind === "long"
                ? TONES.long
                : s.type === "tempo"
                  ? TONES.tempo
                  : TONES.intervals;
          return (
            <div key={s.id} className={`flex flex-col gap-1.5 rounded-[14px] p-3 ${tone.box}`}>
              <tone.Icon className={`h-5 w-5 ${tone.ink}`} aria-hidden="true" />
              <span className={`text-[13px] font-bold ${tone.ink}`}>{s.title}</span>
              <span className={`text-xs ${tone.ink}`}>{slotTarget(s)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-winter-muted">
        {week.plan.status === "draft"
          ? "Draft. The coach locks it in Monday, based on what you actually ran."
          : week.plan.note ?? "Set by the coach."}
      </p>
    </div>
  );
}
