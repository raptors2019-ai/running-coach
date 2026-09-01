"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CircleDashed, Flag } from "lucide-react";

const CHECKPOINT_META: { key: string; label: string; rule: string }[] = [
  { key: "benchmark_2k", label: "2K Benchmark", rule: "≤9:50 → chase 24:30" },
  { key: "race_pace_3k", label: "Race Pace Test", rule: "3K @ 5:00 — Sep 15" },
];

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * The plan is "decided by the checkpoints" — this makes each decision visible
 * so a passed test never reads as an open question.
 */
export function CheckpointCard() {
  const checkpoints = useQuery(api.coach.getCheckpoints);
  if (checkpoints === undefined) return null;

  const byKey = new Map(checkpoints.map((c) => [c.key as string, c]));

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Checkpoints</h2>
      <div className="space-y-1.5">
        {CHECKPOINT_META.map(({ key, label, rule }) => {
          const result = byKey.get(key);
          if (!result) {
            return (
              <div key={key} className="flex items-center gap-2.5 rounded-lg border border-muted p-2.5 text-sm">
                <CircleDashed className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <span className="font-medium">{label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{rule}</span>
              </div>
            );
          }
          return (
            <div key={key} className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50/50 p-2.5 text-sm">
              <Flag className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-medium">
                  {label}
                  {result.resultSeconds !== undefined && (
                    <span className="text-muted-foreground font-normal">
                      {" — "}
                      {formatSeconds(result.resultSeconds)}
                      {result.resultDistanceKm !== undefined && ` / ${result.resultDistanceKm} km`}
                    </span>
                  )}
                </div>
                <div className="text-xs text-green-700 mt-0.5">{result.decision}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
