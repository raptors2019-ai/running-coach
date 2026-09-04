"use client";

import {
  formatClock,
  formatPace,
  formatSplitDistance,
  type Split,
  type SplitKind,
} from "../../convex/lib/splitParsing";
import { AlertTriangle } from "lucide-react";

/** Work reps carry the session; everything else is context around them. */
const KIND_STYLES: Record<SplitKind, { label: string; row: string; accent: string }> = {
  work: { label: "work", row: "bg-primary/5", accent: "bg-primary" },
  recovery: { label: "recovery", row: "", accent: "bg-muted-foreground/30" },
  warmup: { label: "warmup", row: "", accent: "bg-amber-500/60" },
  cooldown: { label: "cooldown", row: "", accent: "bg-sky-500/60" },
  steady: { label: "steady", row: "", accent: "bg-muted-foreground/30" },
  unknown: { label: "", row: "", accent: "bg-transparent" },
};

export function SplitsTable({ splits }: { splits: Split[] }) {
  const showHeartRate = splits.some((s) => s.heartRate);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-muted-foreground text-left">
            <th className="font-normal py-1 pr-1 w-6"></th>
            <th className="font-normal py-1 pr-2">Distance</th>
            <th className="font-normal py-1 pr-2">Time</th>
            <th className="font-normal py-1 pr-2">Pace</th>
            {showHeartRate && <th className="font-normal py-1 text-right">HR</th>}
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => {
            const style = KIND_STYLES[split.kind] ?? KIND_STYLES.unknown;
            const isWork = split.kind === "work";
            return (
              <tr key={split.index} className={`border-t ${style.row}`}>
                <td className="py-1.5 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-1 h-4 rounded-full ${style.accent}`} />
                    <span className="text-xs text-muted-foreground">{split.index}</span>
                  </div>
                </td>
                <td className={`py-1.5 pr-2 ${isWork ? "font-medium" : ""}`}>
                  {formatSplitDistance(split.distanceMeters)}
                  {style.label && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {style.label}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2">{formatClock(split.durationSeconds)}</td>
                <td className={`py-1.5 pr-2 ${isWork ? "font-semibold" : ""}`}>
                  <span className="inline-flex items-center gap-1">
                    {formatPace(split.paceSecondsPerKm)}
                    {split.paceMismatch && (
                      <AlertTriangle
                        className="h-3 w-3 text-amber-500 shrink-0"
                        aria-label={`Screenshot showed ${split.displayedPace} — check this row`}
                      />
                    )}
                  </span>
                </td>
                {showHeartRate && (
                  <td className="py-1.5 text-right text-muted-foreground">
                    {split.heartRate ? `${split.heartRate}` : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {splits.some((s) => s.paceMismatch) && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500 mt-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            A flagged pace doesn&apos;t match the distance and time read from the screenshot — likely a
            misread digit. Check those rows against your watch before trusting them.
          </span>
        </p>
      )}
    </div>
  );
}
