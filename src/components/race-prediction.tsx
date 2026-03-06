"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { predict10KTime, paceToSeconds } from "@/lib/pace-utils";
import { GOAL_TIME_MINUTES } from "@/lib/constants";
import { Target, TrendingDown } from "lucide-react";

export function RacePrediction() {
  const workouts = useQuery(api.workouts.getCompletedWorkouts);

  if (!workouts || workouts.length === 0) {
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
            Complete runs with logged data to see predictions
          </p>
        </CardContent>
      </Card>
    );
  }

  // Find best recent run (longest with logged pace/distance/duration)
  const runsWithData = workouts
    .filter(
      (w) =>
        w.actualDistance &&
        w.actualDuration &&
        w.actualDistance >= 3 &&
        w.type !== "rest" &&
        w.type !== "basketball"
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (runsWithData.length === 0) {
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
            Log run distance and duration to see predictions
          </p>
        </CardContent>
      </Card>
    );
  }

  // Use the most recent qualifying run
  const bestRun = runsWithData[0];
  const prediction = predict10KTime(
    bestRun.actualDistance!,
    bestRun.actualDuration!
  );

  const goalSeconds = GOAL_TIME_MINUTES * 60;
  const startingPaceSeconds = paceToSeconds("7:25");
  const predictedPaceSeconds = paceToSeconds(prediction.predictedPace);
  const goalPaceSeconds = paceToSeconds("6:00");

  // Progress from starting pace to goal pace (lower is better)
  const totalImprovement = startingPaceSeconds - goalPaceSeconds;
  const currentImprovement = startingPaceSeconds - predictedPaceSeconds;
  const progressPercent = Math.min(
    100,
    Math.max(0, (currentImprovement / totalImprovement) * 100)
  );

  const onTrack = prediction.predictedSeconds <= goalSeconds;

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
            {prediction.formattedTime}
          </div>
          <div className="text-sm text-muted-foreground">
            Predicted 10K time ({prediction.predictedPace}/km)
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>7:25/km (start)</span>
            <span>6:00/km (goal)</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          Based on {bestRun.actualDistance}km run on{" "}
          {new Date(bestRun.date + "T12:00:00").toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
          })}
        </div>

        {onTrack ? (
          <div className="text-xs text-green-600 bg-green-50 rounded p-2">
            On track for sub-60! Keep it up.
          </div>
        ) : (
          <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
            {Math.ceil((prediction.predictedSeconds - goalSeconds) / 60)} min over goal. Stay consistent with tempo & interval work.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
