"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { WorkoutDetailDialog } from "./workout-detail-dialog";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { format } from "date-fns";
import { isNonRunningType } from "@/lib/constants";
import { CheckCircle2, Circle, MapPin, Timer, Zap } from "lucide-react";
import { useState } from "react";

function UnplannedWorkoutCard({ workout }: { workout: Doc<"workouts"> }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md border-dashed border-green-200 bg-green-50/30"
        onClick={() => setDialogOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WorkoutTypeBadge type={workout.type} />
              <span className="text-sm font-medium">{workout.title}</span>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
            {workout.actualDistance && (
              <span>{formatDistance(workout.actualDistance)}</span>
            )}
            {workout.actualPace && <span>{workout.actualPace}</span>}
            {workout.actualDuration && (
              <span>
                {Math.floor(workout.actualDuration / 60)}:{(workout.actualDuration % 60).toString().padStart(2, "0")}
              </span>
            )}
          </div>
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

export function DailyWorkoutCard() {
  const today = getLocalDateString();
  const workouts = useQuery(api.workouts.getWorkoutsByDate, { date: today });
  const [dialogOpen, setDialogOpen] = useState(false);

  if (workouts === undefined) {
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

  if (workouts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>No workout scheduled for today.</p>
          <p className="text-sm mt-1">Enjoy your rest!</p>
        </CardContent>
      </Card>
    );
  }

  const plannedWorkout = workouts.find((w) => !w.isUnplanned) || workouts[0];
  const unplannedWorkouts = workouts.filter((w) => w.isUnplanned);
  const isRestDay = isNonRunningType(plannedWorkout.type);

  return (
    <div className="space-y-2">
      <Card
        className={`cursor-pointer transition-shadow hover:shadow-md ${
          plannedWorkout.completed ? "border-green-200 bg-green-50/50" : ""
        } ${plannedWorkout.type === "race" ? "border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50" : ""}`}
        onClick={() => setDialogOpen(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{plannedWorkout.title}</CardTitle>
              <WorkoutTypeBadge type={plannedWorkout.type} />
            </div>
            {plannedWorkout.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/30" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(plannedWorkout.date + "T12:00:00"), "EEEE, MMMM d")}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm mb-3">{plannedWorkout.description}</p>
          {!isRestDay && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {plannedWorkout.targetDistance && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatDistance(plannedWorkout.targetDistance)}
                </div>
              )}
              {plannedWorkout.targetPace && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {plannedWorkout.targetPace}/km
                </div>
              )}
              {plannedWorkout.intervals && plannedWorkout.intervals.length > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {plannedWorkout.intervals[0].reps}x{plannedWorkout.intervals[0].distance}
                </div>
              )}
            </div>
          )}
          {plannedWorkout.completed && plannedWorkout.actualPace && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex gap-4 text-sm text-green-700">
                {plannedWorkout.actualDistance && (
                  <span>{formatDistance(plannedWorkout.actualDistance)}</span>
                )}
                {plannedWorkout.actualPace && <span>{plannedWorkout.actualPace}/km</span>}
                {plannedWorkout.actualDuration && (
                  <span>
                    {Math.floor(plannedWorkout.actualDuration / 60)}:{(plannedWorkout.actualDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <WorkoutDetailDialog
        workout={plannedWorkout}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      {unplannedWorkouts.map((w) => (
        <UnplannedWorkoutCard key={w._id} workout={w} />
      ))}
    </div>
  );
}
