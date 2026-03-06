"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { WorkoutDetailDialog } from "./workout-detail-dialog";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { format } from "date-fns";
import { isNonRunningType } from "@/lib/constants";
import { CheckCircle2, Circle, MapPin, Timer, Zap } from "lucide-react";
import { useState } from "react";

export function DailyWorkoutCard() {
  const today = getLocalDateString();
  const workout = useQuery(api.workouts.getWorkoutByDate, { date: today });
  const [dialogOpen, setDialogOpen] = useState(false);

  if (workout === undefined) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 bg-muted rounded w-1/3 mb-3" />
          <div className="h-4 bg-muted rounded w-2/3 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!workout) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>No workout scheduled for today.</p>
          <p className="text-sm mt-1">Enjoy your rest!</p>
        </CardContent>
      </Card>
    );
  }

  const isRestDay = isNonRunningType(workout.type);

  return (
    <>
      <Card
        className={`cursor-pointer transition-shadow hover:shadow-md ${
          workout.completed ? "border-green-200 bg-green-50/50" : ""
        } ${workout.type === "race" ? "border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50" : ""}`}
        onClick={() => setDialogOpen(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{workout.title}</CardTitle>
              <WorkoutTypeBadge type={workout.type} />
            </div>
            {workout.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/30" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(workout.date + "T12:00:00"), "EEEE, MMMM d")}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm mb-3">{workout.description}</p>
          {!isRestDay && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {workout.targetDistance && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatDistance(workout.targetDistance)}
                </div>
              )}
              {workout.targetPace && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {workout.targetPace}/km
                </div>
              )}
              {workout.intervals && workout.intervals.length > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {workout.intervals[0].reps}x{workout.intervals[0].distance}
                </div>
              )}
            </div>
          )}
          {workout.completed && workout.actualPace && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex gap-4 text-sm text-green-700">
                {workout.actualDistance && (
                  <span>{formatDistance(workout.actualDistance)}</span>
                )}
                {workout.actualPace && <span>{workout.actualPace}/km</span>}
                {workout.actualDuration && (
                  <span>
                    {Math.floor(workout.actualDuration / 60)}:{(workout.actualDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <WorkoutDetailDialog
        workout={workout}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
