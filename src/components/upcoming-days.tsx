"use client";

import { Doc } from "../../convex/_generated/dataModel";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { format, parseISO, addDays } from "date-fns";
import { getLocalDateString, formatDistance } from "@/lib/pace-utils";
import { MapPin, Timer, Zap, CheckCircle2 } from "lucide-react";
import { WorkoutTypeBadge } from "./workout-type-badge";

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface UpcomingDaysProps {
  workouts: Doc<"workouts">[];
}

export function UpcomingDays({ workouts }: UpcomingDaysProps) {
  const today = getLocalDateString();
  const baseDate = new Date(today + "T12:00:00");

  // Next 3 days starting from tomorrow
  const upcomingDates = Array.from({ length: 3 }, (_, i) =>
    toDateString(addDays(baseDate, i + 1))
  );

  const workoutsByDate = new Map<string, Doc<"workouts">[]>();
  for (const w of workouts) {
    const group = workoutsByDate.get(w.date) || [];
    group.push(w);
    workoutsByDate.set(w.date, group);
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Coming Up</h2>
      <div className="space-y-1.5">
        {upcomingDates.map((date) => {
          const dayWorkouts = workoutsByDate.get(date) || [];
          const planned =
            dayWorkouts.find((w) => !w.isUnplanned) || dayWorkouts[0] || null;

          if (!planned) {
            return (
              <div
                key={date}
                className="flex items-center gap-3 rounded-lg border border-muted p-2.5"
              >
                <div className="text-center w-10 shrink-0">
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {format(parseISO(date), "EEE")}
                  </div>
                  <div className="text-sm font-bold">
                    {format(parseISO(date), "d")}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Rest</div>
              </div>
            );
          }

          return (
            <div
              key={date}
              className="flex items-center gap-3 rounded-lg border border-muted p-2.5"
            >
              <div className="text-center w-10 shrink-0">
                <div className="text-[10px] text-muted-foreground font-medium">
                  {format(parseISO(date), "EEE")}
                </div>
                <div className="text-sm font-bold">
                  {format(parseISO(date), "d")}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">
                    {planned.title}
                  </span>
                  {planned.completed && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {planned.targetDistance && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {formatDistance(planned.targetDistance)}
                    </span>
                  )}
                  {planned.targetPace && (
                    <span className="flex items-center gap-0.5">
                      <Timer className="h-3 w-3" />
                      {planned.targetPace}/km
                    </span>
                  )}
                  {planned.intervals && planned.intervals.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Zap className="h-3 w-3" />
                      {planned.intervals[0].reps}x{planned.intervals[0].distance}
                    </span>
                  )}
                </div>
              </div>
              <WorkoutTypeBadge type={planned.type} className="shrink-0 text-[10px]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
