import { Bike, Dribbble, Dumbbell, Footprints, Waves } from "lucide-react";

/** Cross-training as chips: rides summed by km, everything else counted. */
export function groupCrossTraining(rows: { type: string; title: string; actualDistance?: number }[]) {
  const groups = new Map<string, { label: string; count: number; km: number; Icon: typeof Bike; tone: string }>();
  for (const r of rows) {
    const t = `${r.type} ${r.title}`.toLowerCase();
    const kind = /ride|bike|cycl/.test(t)
      ? "ride"
      : /basketball|hoops/.test(t)
        ? "hoops"
        : /weight|lift|upper|lower|strength/.test(t)
          ? "lift"
          : /swim/.test(t)
            ? "swim"
            : "other";
    const meta = {
      ride: { label: "Ride", Icon: Bike, tone: "bg-[#fff1d6] text-[#7a4a00]" },
      hoops: { label: "Hoops", Icon: Dribbble, tone: "bg-sunrise-soft text-[#8a3210]" },
      lift: { label: "Lifts", Icon: Dumbbell, tone: "bg-[#ebe6ff] text-[#3d2a8a]" },
      swim: { label: "Swim", Icon: Waves, tone: "bg-[#dff6fb] text-[#0e5566]" },
      other: { label: "Other", Icon: Footprints, tone: "bg-[#eef0f8] text-winter-muted" },
    }[kind];
    const g = groups.get(kind) ?? { ...meta, count: 0, km: 0 };
    g.count++;
    g.km += r.actualDistance ?? 0;
    groups.set(kind, g);
  }
  return [...groups.entries()].map(([kind, g]) => ({
    kind,
    ...g,
    text: kind === "ride" && g.km > 0 ? `Ride ${Math.round(g.km)} km` : g.count > 1 ? `${g.label} ×${g.count}` : g.label,
  }));
}
