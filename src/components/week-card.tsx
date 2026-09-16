"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Doc } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableWorkoutRow } from "./sortable-workout-row";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { getWeekBounds } from "@/lib/weekly-stats";
import { RUNNING_TYPES, MIN_RUNS_PER_WEEK } from "@/lib/constants";
import Link from "next/link";
import { Share2 } from "lucide-react";

interface WeekCardProps {
  weekNum: number;
  weekLabel: string;
  workouts: Doc<"workouts">[];
  onSelectWorkout: (workout: Doc<"workouts">) => void;
}

export function WeekCard({ weekNum, weekLabel, workouts, onSelectWorkout }: WeekCardProps) {
  const today = getLocalDateString();
  const totalDistance = workouts.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
  const completed = workouts.filter((w) => w.completed).length;

  const runCount = workouts.filter((w) => RUNNING_TYPES.has(w.type)).length;
  const minRuns = MIN_RUNS_PER_WEEK[weekNum] ?? 3;
  const diff = minRuns - runCount;

  let quotaColor = "text-green-600";
  if (diff === 1) quotaColor = "text-yellow-600";
  if (diff >= 2) quotaColor = "text-red-600";

  const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{weekLabel}</CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {weekNum > 0 && (
              <span className={quotaColor}>{runCount}/{minRuns} runs</span>
            )}
            <span>{formatDistance(totalDistance)} | {completed}/{workouts.length} done</span>
            {completed > 0 && (
              <Link
                href={`/recap?start=${getWeekBounds(sortedWorkouts[sortedWorkouts.length - 1].date).start}`}
                aria-label={`Share ${weekLabel}`}
                className="hover:text-foreground transition-colors"
              >
                <Share2 className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
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
