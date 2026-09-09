"use client";

import { useMutation, useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { ManualEntryForm } from "./manual-entry-form";
import { formatDistance, formatPaceDisplay, getLocalDateString } from "@/lib/pace-utils";
import { substitutionOptions, substitutionMessage, plannedTitle } from "@/lib/substitution";
import { format } from "date-fns";
import { isNonRunningType } from "@/lib/constants";
import { CheckCircle2, MapPin, Timer, Zap, Undo2, ListOrdered, Shuffle } from "lucide-react";
import { SplitsTable } from "./splits-table";
import Link from "next/link";
import { useState } from "react";

/** Off-plan things the athlete might do in place of a session. */
const SUBSTITUTE_TYPES = [
  { type: "easy", title: "Easy Run" },
  { type: "long", title: "Long Run" },
  { type: "tempo", title: "Tempo Run" },
  { type: "swim", title: "Swim" },
  { type: "cross_training", title: "Cross Training" },
  { type: "rest", title: "Rest Day" },
];

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
  const splitUploads = useQuery(api.splits.getUploadsForDate, { date: workout.date });
  const readySplits = (splitUploads ?? []).filter((u) => u.status === "ready");
  const markComplete = useMutation(api.workouts.markWorkoutComplete);
  const unmarkComplete = useMutation(api.workouts.unmarkWorkoutComplete);
  const swapWorkoutDates = useMutation(api.workouts.swapWorkoutDates);
  const updateWorkoutType = useMutation(api.workouts.updateWorkoutType);
  const syncAndAutoMatch = useAction(api.strava.syncAndAutoMatch);
  const router = useRouter();

  const isRestDay = isNonRunningType(workout.type);

  // "Did something else?" — for a day that is done or has passed, relabel it
  // with what was actually done and hand the week to the coach to rebalance.
  const [substituting, setSubstituting] = useState(false);
  const [choice, setChoice] = useState("");
  const [substituteError, setSubstituteError] = useState<string | null>(null);
  const canSubstitute = !workout.isUnplanned && (workout.completed || workout.date < getLocalDateString());
  const weekWorkouts = useQuery(
    api.workouts.getWorkoutsByWeek,
    canSubstitute ? { weekNumber: workout.weekNumber } : "skip"
  );
  const swapOptions = substitutionOptions(weekWorkouts ?? [], workout);

  const handleSubstitute = async () => {
    if (!choice) return;
    setSubstituteError(null);
    let did: string;
    try {
      if (choice.startsWith("w:")) {
        const other = swapOptions.find((w) => w._id === choice.slice(2));
        if (!other) return;
        await swapWorkoutDates({ workoutId1: workout._id, workoutId2: other._id as Id<"workouts"> });
        did = other.title;
      } else {
        const type = choice.slice(2);
        did = SUBSTITUTE_TYPES.find((t) => t.type === type)?.title ?? type;
        await updateWorkoutType({ workoutId: workout._id, type, title: did });
      }
    } catch (e) {
      setSubstituteError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      return;
    }
    // The day's plan just changed — let Strava's run land on it right away.
    syncAndAutoMatch({}).catch(() => {});
    const message = substitutionMessage({ date: workout.date, did, insteadOf: plannedTitle(workout) });
    onOpenChange(false);
    router.push(`/coach?draft=${encodeURIComponent(message)}`);
  };

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

          {readySplits.length > 0 && (
            <div className="space-y-3">
              {readySplits.map((upload) => (
                <div key={upload._id} className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm font-medium mb-1 flex items-center gap-1">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Splits
                    {upload.source && (
                      <span className="font-normal text-muted-foreground">· {upload.source}</span>
                    )}
                  </div>
                  {upload.workReps && (
                    <p className="text-sm font-medium text-primary mb-2">{upload.workReps}</p>
                  )}
                  <SplitsTable splits={upload.splits ?? []} />
                </div>
              ))}
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

          {workout.completed && !isRestDay && readySplits.length === 0 && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/splits">
                <ListOrdered className="h-3.5 w-3.5 mr-1" />
                Add splits from your watch
              </Link>
            </Button>
          )}

          {canSubstitute && !substituting && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubstituting(true)}
              className="w-full"
            >
              <Shuffle className="h-3.5 w-3.5 mr-1" />
              Did something else?
            </Button>
          )}

          {canSubstitute && substituting && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <label htmlFor="substitute-choice" className="text-sm font-medium">
                What did you do instead?
              </label>
              <select
                id="substitute-choice"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="w-full text-sm rounded border border-input bg-background px-2 py-1.5"
              >
                <option value="">Choose…</option>
                {swapOptions.length > 0 && (
                  <optgroup label="Swap with this week">
                    {swapOptions.map((w) => (
                      <option key={w._id} value={`w:${w._id}`}>
                        {w.title} ({format(new Date(w.date + "T12:00:00"), "EEE")})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Something off-plan">
                  {SUBSTITUTE_TYPES.map((t) => (
                    <option key={t.type} value={`t:${t.type}`}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-muted-foreground">
                This day keeps its logged run. The coach gets a message to rebalance the week — you can edit it before sending.
              </p>
              {substituteError && <p className="text-xs text-red-600">{substituteError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSubstitute} disabled={!choice} className="flex-1">
                  Update &amp; tell coach
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSubstituting(false);
                    setChoice("");
                    setSubstituteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
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
