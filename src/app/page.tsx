"use client";

import { useState } from "react";
import { CountdownBadge } from "@/components/countdown-badge";
import { WeatherWidget } from "@/components/weather-widget";
import { WeekPreview } from "@/components/week-preview";
import { UpcomingDays } from "@/components/upcoming-days";
import { JournalNudgeBanner } from "@/components/journal-nudge-banner";
import { WeatherOptimizerDialog } from "@/components/weather-optimizer-dialog";
import { Button } from "@/components/ui/button";
import { useAutoStravaSync } from "@/lib/use-auto-sync";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { CloudSun } from "lucide-react";
import { startOfWeek, endOfWeek, parseISO } from "date-fns";

function getWeeklyStats(workouts: Array<{ date: string; completed: boolean; targetDistance?: number; actualDistance?: number }>) {
  const today = parseISO(getLocalDateString());
  // Week starts on Sunday
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

  const thisWeek = workouts.filter((w) => w.date >= weekStartStr && w.date <= weekEndStr);
  const completed = thisWeek.filter((w) => w.completed);
  const plannedKm = thisWeek.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
  const completedKm = completed.reduce((sum, w) => sum + (w.actualDistance || w.targetDistance || 0), 0);

  return {
    completedCount: completed.length,
    totalCount: thisWeek.length,
    completedKm,
    plannedKm,
  };
}

export default function HomePage() {
  useAutoStravaSync();
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const plan = useQuery(api.workouts.getTrainingPlan);
  const workouts = useQuery(api.workouts.getAllWorkouts);

  const stats = workouts ? getWeeklyStats(workouts) : null;

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

      {workouts && <WeekPreview workouts={workouts} />}

      <JournalNudgeBanner />

      {workouts && <UpcomingDays workouts={workouts} />}

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
            <div className="text-2xl font-bold">{stats.completedCount}/{stats.totalCount}</div>
            <div className="text-xs text-muted-foreground">This Week</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {formatDistance(stats.completedKm)}
            </div>
            <div className="text-xs text-muted-foreground">
              of {formatDistance(stats.plannedKm)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
