"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatDuration,
  formatPaceDisplay,
  getLocalDateString,
  calculatePace,
} from "@/lib/pace-utils";
import {
  selectPredictionBasis,
  effectiveGoalSeconds,
  recentRuns,
  isHardEffort,
  BASELINE_5K_SECONDS,
  BASELINE_LABEL,
} from "@/lib/progress";
import { RACE_DISTANCE_KM } from "@/lib/constants";
import { Target, Flag, AlertTriangle, Info } from "lucide-react";

function shortDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export function RacePrediction() {
  const workouts = useQuery(api.workouts.getCompletedWorkouts);
  const checkpoints = useQuery(api.coach.getCheckpoints);
  const plan = useQuery(api.workouts.getTrainingPlan);

  if (workouts === undefined || checkpoints === undefined || plan === undefined) {
    return null;
  }

  const basis = selectPredictionBasis(workouts, getLocalDateString());
  const goalSeconds = effectiveGoalSeconds(plan, checkpoints);
  const planGoalSeconds = plan?.goalTime ?? 25 * 60;
  const goalUpgraded = goalSeconds !== planGoalSeconds;
  const hasRacePaceTest = checkpoints.some((c) => c.key === "race_pace_3k");

  if (!basis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Race Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Log a run with distance and time to see a prediction
          </p>
        </CardContent>
      </Card>
    );
  }

  const { workout, predictedSeconds, kind } = basis;
  const predictedPace = calculatePace(RACE_DISTANCE_KM, predictedSeconds);
  const onTrack = predictedSeconds <= goalSeconds;
  const gapSeconds = Math.round(Math.abs(predictedSeconds - goalSeconds));
  const gapLabel = gapSeconds < 60 ? `${gapSeconds}s` : formatDuration(gapSeconds);
  // Within half a minute either way, a 2K-based estimate can't tell the difference.
  const onTarget = gapSeconds <= 30;

  // Progress from the April baseline to the goal, measured in predicted 5K time.
  const totalImprovement = BASELINE_5K_SECONDS - goalSeconds;
  const currentImprovement = BASELINE_5K_SECONDS - predictedSeconds;
  const progressPercent = Math.min(
    100,
    Math.max(0, (currentImprovement / totalImprovement) * 100)
  );

  const latestEasy = recentRuns(workouts, 20).find(
    (w) => !isHardEffort(w.type) && w.actualPace
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Race Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div
            className={`text-3xl font-bold ${onTrack ? "text-green-600" : "text-amber-600"}`}
          >
            {formatDuration(predictedSeconds)}
          </div>
          <div className="text-sm text-muted-foreground">
            Predicted {RACE_DISTANCE_KM}K time ({predictedPace}/km)
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Goal {formatDuration(goalSeconds)}
            {goalUpgraded && (
              <span> · upgraded from {formatDuration(planGoalSeconds)} after the benchmark</span>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{formatDuration(BASELINE_5K_SECONDS)} (April)</span>
            <span>{formatDuration(goalSeconds)} (goal)</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="text-[11px] text-muted-foreground mt-1">
            Baseline: {BASELINE_LABEL}
          </div>
        </div>

        <div className="rounded-md border p-2.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Flag className="h-3 w-3" />
            Based on {kind === "hard" ? "your hardest recent effort" : "your latest run"}
          </div>
          <div className="text-muted-foreground">
            {workout.title} · {shortDate(workout.date)} · {workout.actualDistance} km in{" "}
            {formatDuration(workout.actualDuration!)}
            {workout.actualPace && <> ({formatPaceDisplay(workout.actualPace)})</>}
          </div>
        </div>

        {kind === "easy" && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              No hard effort logged in the last 8 weeks, so this extrapolates an easy run.
              It will read slow by design. Your next tempo or time trial replaces it.
            </span>
          </div>
        )}

        {kind === "hard" && latestEasy && (
          <div className="text-xs text-muted-foreground flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Zone 2 runs don&apos;t feed this number. Your latest easy run was{" "}
              {formatPaceDisplay(latestEasy.actualPace!)} on {shortDate(latestEasy.date)},
              which is exactly where it should be.
            </span>
          </div>
        )}

        {onTarget ? (
          <div className="text-xs text-green-700 bg-green-50 rounded p-2">
            Within {gapLabel} of goal on paper ({onTrack ? "under" : "over"}). A 2K time trial
            flatters a 5K estimate, so protect the Tuesday sessions and build the floor with the
            long runs.
          </div>
        ) : onTrack ? (
          <div className="text-xs text-green-700 bg-green-50 rounded p-2">
            {gapLabel} under goal on paper. Keep the hard days hard and the easy days easy.
          </div>
        ) : (
          <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
            {gapLabel} over goal. Stay consistent with tempo &amp; interval work.
          </div>
        )}

        {!hasRacePaceTest && (
          <div className="text-xs text-muted-foreground">
            Next data point: Sep 15 race pace test (3K @ 5:00/km). That result replaces this
            estimate.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
