"use client";

import { CountdownBadge } from "@/components/countdown-badge";
import { DailyWorkoutCard } from "@/components/daily-workout-card";
import { WeatherWidget } from "@/components/weather-widget";
import { RacePrediction } from "@/components/race-prediction";
import { WeekPreview } from "@/components/week-preview";
import { JournalNudgeBanner } from "@/components/journal-nudge-banner";
import { useAutoStravaSync } from "@/lib/use-auto-sync";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistance } from "@/lib/pace-utils";

export default function HomePage() {
  useAutoStravaSync();
  const plan = useQuery(api.workouts.getTrainingPlan);
  const workouts = useQuery(api.workouts.getAllWorkouts);

  const completedCount = workouts?.filter((w) => w.completed).length || 0;
  const totalCount = workouts?.length || 0;
  const totalPlannedKm =
    workouts?.reduce((sum, w) => sum + (w.targetDistance || 0), 0) || 0;
  const completedKm =
    workouts
      ?.filter((w) => w.completed)
      .reduce((sum, w) => sum + (w.actualDistance || w.targetDistance || 0), 0) || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Running Coach</h1>
          {plan && (
            <p className="text-sm text-muted-foreground">{plan.name}</p>
          )}
        </div>
        <CountdownBadge />
      </div>

      <DailyWorkoutCard />

      <JournalNudgeBanner />

      {workouts && <WeekPreview workouts={workouts} />}

      <WeatherWidget />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
          <div className="text-xs text-muted-foreground">Workouts Done</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">
            {formatDistance(completedKm)}
          </div>
          <div className="text-xs text-muted-foreground">
            of {formatDistance(totalPlannedKm)}
          </div>
        </div>
      </div>

      <RacePrediction />
    </div>
  );
}
