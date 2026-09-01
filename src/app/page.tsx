"use client";

import { useState } from "react";
import { CountdownBadge } from "@/components/countdown-badge";
import { StalePlanBanner } from "@/components/stale-plan-banner";
import { WeatherWidget } from "@/components/weather-widget";
import { WeekPreview } from "@/components/week-preview";
import { UpcomingDays } from "@/components/upcoming-days";
import { JournalNudgeBanner } from "@/components/journal-nudge-banner";
import { CheckpointCard } from "@/components/checkpoint-card";
import { WeatherOptimizerDialog } from "@/components/weather-optimizer-dialog";
import { Button } from "@/components/ui/button";
import { useAutoStravaSync } from "@/lib/use-auto-sync";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { CloudSun } from "lucide-react";
import { getWeeklyStats } from "@/lib/weekly-stats";

export default function HomePage() {
  useAutoStravaSync();
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const plan = useQuery(api.workouts.getTrainingPlan);
  const workouts = useQuery(api.workouts.getAllWorkouts);

  const stats = workouts ? getWeeklyStats(workouts, getLocalDateString()) : null;

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

      <StalePlanBanner />

      {workouts && <WeekPreview workouts={workouts} />}

      <JournalNudgeBanner />

      {workouts && <UpcomingDays workouts={workouts} />}

      <CheckpointCard />

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOptimizerOpen(true)}
      >
        <CloudSun className="h-4 w-4 mr-2" />
        Optimize for Weather
      </Button>
      <WeatherOptimizerDialog
        open={optimizerOpen}
        onOpenChange={setOptimizerOpen}
      />

      <WeatherWidget />

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.runsDone}/{stats.runsPlanned}</div>
            <div className="text-xs text-muted-foreground">
              Runs this week{stats.extraRuns > 0 && ` · +${stats.extraRuns} extra`}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {formatDistance(stats.actualKm)}
            </div>
            <div className="text-xs text-muted-foreground">
              of {formatDistance(stats.plannedKm)} planned
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
