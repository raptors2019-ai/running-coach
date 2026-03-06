"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { ManualEntryForm } from "./manual-entry-form";
import { formatDistance } from "@/lib/pace-utils";
import { format } from "date-fns";
import { isNonRunningType } from "@/lib/constants";
import { CheckCircle2, MapPin, Timer, Zap, Undo2 } from "lucide-react";
import { useState } from "react";

interface WorkoutDetailDialogProps {
  workout: Doc<"workouts">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkoutDetailDialog({
  workout,
  open,
  onOpenChange,
}: WorkoutDetailDialogProps) {
  const [showEntryForm, setShowEntryForm] = useState(false);
  const markComplete = useMutation(api.workouts.markWorkoutComplete);
  const unmarkComplete = useMutation(api.workouts.unmarkWorkoutComplete);

  const isRestDay = isNonRunningType(workout.type);

  const handleQuickComplete = async () => {
    await markComplete({
      workoutId: workout._id,
      actualDistance: workout.targetDistance,
    });
  };

  const handleUncomplete = async () => {
    await unmarkComplete({ workoutId: workout._id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{workout.title}</DialogTitle>
            <WorkoutTypeBadge type={workout.type} />
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(workout.date + "T12:00:00"), "EEEE, MMMM d")} - Week {workout.weekNumber}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">{workout.description}</p>

          {!isRestDay && (
            <div className="flex flex-wrap gap-3 text-sm">
              {workout.targetDistance && (
                <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatDistance(workout.targetDistance)}
                </div>
              )}
              {workout.targetPace && (
                <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                  <Timer className="h-3.5 w-3.5" />
                  {workout.targetPace}/km
                </div>
              )}
            </div>
          )}

          {workout.intervals && workout.intervals.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                Intervals
              </div>
              {workout.intervals.map((interval, i) => (
                <div key={i} className="text-sm">
                  {interval.reps}x {interval.distance} @ {interval.pace} ({interval.rest} rest)
                </div>
              ))}
            </div>
          )}

          {workout.completed && (
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="flex items-center gap-1.5 text-green-700 font-medium mb-2">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                {workout.actualDistance && (
                  <div>Distance: {formatDistance(workout.actualDistance)}</div>
                )}
                {workout.actualPace && <div>Pace: {workout.actualPace}/km</div>}
                {workout.actualDuration && (
                  <div>
                    Duration: {Math.floor(workout.actualDuration / 60)}:{(workout.actualDuration % 60).toString().padStart(2, "0")}
                  </div>
                )}
                {workout.avgHeartRate && <div>HR: {workout.avgHeartRate} bpm</div>}
              </div>
              {workout.notes && (
                <p className="text-sm text-green-600 mt-2">{workout.notes}</p>
              )}
            </div>
          )}

          {!workout.completed && !isRestDay && !showEntryForm && (
            <div className="flex gap-2">
              <Button onClick={handleQuickComplete} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Quick Complete
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEntryForm(true)}
                className="flex-1"
              >
                Log Details
              </Button>
            </div>
          )}

          {!workout.completed && isRestDay && (
            <Button onClick={handleQuickComplete} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark as Done
            </Button>
          )}

          {workout.completed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUncomplete}
              className="text-muted-foreground"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Undo completion
            </Button>
          )}

          {showEntryForm && !workout.completed && (
            <ManualEntryForm
              workout={workout}
              onComplete={() => {
                setShowEntryForm(false);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
