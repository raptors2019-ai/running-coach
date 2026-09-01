"use client";

import { useMutation, useQuery } from "convex/react";
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
import { StatusChip } from "./status-chip";
import { ManualEntryForm } from "./manual-entry-form";
import { formatDistance, formatPaceDisplay } from "@/lib/pace-utils";
import { format, parseISO } from "date-fns";
import { isNonRunningType, isRunType } from "@/lib/constants";
import { CalendarCheck, CheckCircle2, MapPin, Timer, Zap, Undo2 } from "lucide-react";
import { useState } from "react";

interface WorkoutDetailDialogProps {
  workout: Doc<"workouts">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const longDate = (date: string) => format(parseISO(date), "EEEE, MMMM d");

export function WorkoutDetailDialog({
  workout,
  open,
  onOpenChange,
}: WorkoutDetailDialogProps) {
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [linking, setLinking] = useState(false);
  const markComplete = useMutation(api.workouts.markWorkoutComplete);
  const unmarkComplete = useMutation(api.workouts.unmarkWorkoutComplete);
  const linkRun = useMutation(api.workouts.linkRunToPlanned);

  const isRestDay = isNonRunningType(workout.type);

  // An extra run can be credited to a planned run it stood in for, and a
  // planned run that's still open can claim a nearby extra run.
  const isExtraRun = !!workout.isUnplanned && workout.completed && isRunType(workout.type);
  const isOpenPlannedRun = !workout.isUnplanned && !workout.completed && isRunType(workout.type);
  const makeUpOptions = useQuery(
    api.workouts.getMakeUpOptions,
    isExtraRun || isOpenPlannedRun ? { workoutId: workout._id } : "skip"
  );

  const madeUpOn =
    workout.completedDate && workout.completedDate !== workout.date ? workout.completedDate : null;

  const handleQuickComplete = async () => {
    await markComplete({
      workoutId: workout._id,
      actualDistance: workout.targetDistance,
    });
  };

  const handleUncomplete = async () => {
    await unmarkComplete({ workoutId: workout._id });
  };

  const handleLink = async (other: Doc<"workouts">) => {
    setLinking(true);
    try {
      await linkRun(
        isExtraRun
          ? { runId: workout._id, plannedId: other._id }
          : { runId: other._id, plannedId: workout._id }
      );
    } finally {
      setLinking(false);
    }
    // The extra run's row is folded into the planned one and no longer exists.
    if (isExtraRun) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{workout.title}</DialogTitle>
            <WorkoutTypeBadge type={workout.type} />
            {workout.isUnplanned && <StatusChip tone="green">Extra</StatusChip>}
          </div>
          <p className="text-sm text-muted-foreground">
            {longDate(workout.date)}
            {workout.weekNumber > 0 && ` - Week ${workout.weekNumber}`}
            {workout.isUnplanned && " · not on the plan"}
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
                {madeUpOn && (
                  <span className="font-normal text-green-600">
                    · done {format(parseISO(madeUpOn), "EEE, MMM d")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                {workout.actualDistance && (
                  <div>Distance: {formatDistance(workout.actualDistance)}</div>
                )}
                {workout.actualPace && <div>Pace: {formatPaceDisplay(workout.actualPace)}</div>}
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

          {makeUpOptions && makeUpOptions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarCheck className="h-4 w-4 text-blue-600" />
                {isExtraRun ? "Count this run as a planned run" : "Ran this on another day?"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isExtraRun
                  ? "This run wasn't on the plan. If it stood in for a run you missed or did early, credit it to that workout."
                  : "Pick the extra run that stood in for this one. This slot stays in the plan and takes that run's stats."}
              </p>
              <div className="space-y-1">
                {makeUpOptions.map((o) => (
                  <button
                    key={o._id}
                    disabled={linking}
                    onClick={() => handleLink(o)}
                    className="flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left text-sm hover:bg-muted/70 disabled:opacity-50"
                  >
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">
                      {format(parseISO(o.date), "EEE d")}
                    </span>
                    <WorkoutTypeBadge type={o.type} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{o.title}</span>
                    {!o.completed && o.missedAt && <StatusChip tone="amber">Missed</StatusChip>}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {o.completed && o.actualDistance
                        ? formatDistance(o.actualDistance)
                        : o.targetDistance
                          ? formatDistance(o.targetDistance)
                          : ""}
                    </span>
                  </button>
                ))}
              </div>
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
