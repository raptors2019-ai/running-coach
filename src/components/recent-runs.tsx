"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatPaceDisplay, getLocalDateString } from "@/lib/pace-utils";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { recentRuns, selectPredictionBasis, isHardEffort } from "@/lib/progress";
import { Heart, Target } from "lucide-react";

const RUN_LIMIT = 8;

function runLabel(type: string): string {
  return WORKOUT_TYPE_LABELS[type] ?? "Run";
}

export function RecentRuns() {
  const workouts = useQuery(api.workouts.getCompletedWorkouts);
  if (workouts === undefined) return null;

  const runs = recentRuns(workouts, RUN_LIMIT);
  const basisId = selectPredictionBasis(workouts, getLocalDateString())?.workout._id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Runs</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No runs logged yet</p>
        ) : (
          <ul className="divide-y">
            {runs.map((run) => {
              const hard = isHardEffort(run.type);
              const isBasis = run._id === basisId;
              const label = hard ? "Hard" : runLabel(run.type);
              const showLabel = hard || label !== run.title;
              return (
                <li key={run._id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(run.date + "T12:00:00").toLocaleDateString("en-CA", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{run.title}</span>
                        {showLabel && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              hard
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {label}
                          </span>
                        )}
                        {isBasis && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-0.5">
                            <Target className="h-2.5 w-2.5" />
                            Prediction basis
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">
                        {run.actualDuration ? formatDuration(run.actualDuration) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {run.actualDistance ? `${run.actualDistance} km` : ""}
                        {run.actualPace && <> · {formatPaceDisplay(run.actualPace)}</>}
                      </div>
                      {run.avgHeartRate && (
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                          <Heart className="h-2.5 w-2.5" />
                          {run.avgHeartRate} bpm
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
