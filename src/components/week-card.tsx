"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Doc } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableWorkoutRow } from "./sortable-workout-row";
import { StatusChip } from "./status-chip";
import { getLocalDateString } from "@/lib/pace-utils";
import { getWeekSummary } from "@/lib/weekly-stats";
import { MIN_RUNS_PER_WEEK } from "@/lib/constants";
import { format, parseISO } from "date-fns";

interface WeekCardProps {
  weekNum: number;
  weekLabel: string;
  workouts: Doc<"workouts">[];
  onSelectWorkout: (workout: Doc<"workouts">) => void;
}

const km = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

export function WeekCard({ weekNum, weekLabel, workouts, onSelectWorkout }: WeekCardProps) {
  const today = getLocalDateString();
  const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const s = getWeekSummary(workouts);

  const first = sortedWorkouts[0]?.date;
  const last = sortedWorkouts[sortedWorkouts.length - 1]?.date;
  const isCurrent = !!first && !!last && today >= first && today <= last;
  const range =
    first && last ? `${format(parseISO(first), "MMM d")} – ${format(parseISO(last), "MMM d")}` : "";

  // The plan needs a minimum number of runs per week; editing a run into a
  // lift can quietly drop below it. Warn on the schedule, not on completion.
  const minRuns = MIN_RUNS_PER_WEEK[weekNum];
  const shortOnRuns = weekNum > 0 && minRuns !== undefined && s.runsPlanned < minRuns;

  const allDone = s.runsPlanned > 0 && s.runsDone === s.runsPlanned;
  const pct = s.runsPlanned > 0 ? Math.min(100, (s.runsDone / s.runsPlanned) * 100) : 0;
  let runsTone = "";
  if (allDone) runsTone = "text-green-600";
  else if (s.runsMissed > 0) runsTone = "text-amber-600";

  return (
    <Card className={isCurrent ? "border-blue-200" : undefined}>
      <CardHeader className="pb-3 gap-2">
        <div>
          <CardTitle className="text-base leading-tight">{weekLabel}</CardTitle>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {isCurrent && <span className="font-semibold text-blue-700">This week · </span>}
            {range}
          </div>
        </div>

        {s.runsPlanned > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="tabular-nums">
                <span className={`font-semibold ${runsTone}`}>{s.runsDone}</span>
                <span className="text-muted-foreground">/{s.runsPlanned} runs</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {km(s.actualKm)} of {km(s.plannedKm)} km run
              </span>
              {s.extraRuns > 0 && (
                <StatusChip tone="green">
                  +{s.extraRuns} extra run{s.extraRuns > 1 ? "s" : ""}
                </StatusChip>
              )}
              {s.runsMissed > 0 && <StatusChip tone="amber">{s.runsMissed} missed</StatusChip>}
              {s.otherPlanned > 0 && (
                <span className="tabular-nums text-xs text-muted-foreground">
                  {s.otherDone}/{s.otherPlanned} strength
                </span>
              )}
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Planned runs completed"
              aria-valuemin={0}
              aria-valuenow={s.runsDone}
              aria-valuemax={s.runsPlanned}
            >
              <div
                className={`h-full rounded-full transition-[width] ${allDone ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <div className="tabular-nums text-sm text-muted-foreground">
            {s.extraRuns} run{s.extraRuns === 1 ? "" : "s"} logged · {km(s.actualKm)} km
          </div>
        )}

        {shortOnRuns && (
          <p className="text-xs text-amber-700">
            Only {s.runsPlanned} of {minRuns} runs scheduled this week.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <SortableContext items={sortedWorkouts.map((w) => w._id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {sortedWorkouts.map((workout) => (
              <SortableWorkoutRow
                key={workout._id}
                workout={workout}
                isToday={workout.date === today}
                onSelect={onSelectWorkout}
              />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}
