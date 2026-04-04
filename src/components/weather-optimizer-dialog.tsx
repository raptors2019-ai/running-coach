"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorkoutTypeBadge } from "@/components/workout-type-badge";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  CloudLightning,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { OptimizationResult } from "../../convex/lib/weatherOptimizer";
import { format, parseISO } from "date-fns";

function getWeatherIcon(condition: string) {
  switch (condition) {
    case "Clear":
      return <Sun className="h-4 w-4 text-yellow-500" />;
    case "Clouds":
      return <Cloud className="h-4 w-4 text-gray-400" />;
    case "Rain":
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    case "Drizzle":
      return <CloudDrizzle className="h-4 w-4 text-blue-400" />;
    case "Snow":
    case "Ice":
      return <CloudSnow className="h-4 w-4 text-sky-300" />;
    case "Thunderstorm":
      return <CloudLightning className="h-4 w-4 text-purple-500" />;
    default:
      return <Cloud className="h-4 w-4 text-gray-400" />;
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

interface WeatherOptimizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeatherOptimizerDialog({
  open,
  onOpenChange,
}: WeatherOptimizerDialogProps) {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const optimize = useAction(api.weatherOptimize.optimizeUpcomingWorkouts);
  const applyOptimization = useAction(api.weatherOptimize.applyOptimization);

  const handleOpen = async (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !result) {
      setLoading(true);
      try {
        const res = await optimize();
        setResult(res);
      } catch (err) {
        console.error("Failed to optimize:", err);
      } finally {
        setLoading(false);
      }
    }
    if (!isOpen) {
      setResult(null);
      setApplied(false);
    }
  };

  const handleApply = async () => {
    if (!result || result.proposals.length === 0) return;
    setApplying(true);
    try {
      await applyOptimization({
        swaps: result.proposals.map((p) => ({
          workout1Id: p.workout1Id,
          workout2Id: p.workout2Id,
        })),
      });
      setApplied(true);
    } catch (err) {
      console.error("Failed to apply optimization:", err);
    } finally {
      setApplying(false);
    }
  };

  // Build a map of date -> forecast for display
  const forecastMap = new Map(
    result?.forecast.map((f) => [f.date, f]) ?? []
  );

  // Build maps for current and proposed workouts by date
  const currentByDate = new Map(
    result?.currentSchedule.map((w) => [w.date, w]) ?? []
  );
  const proposedByDate = new Map(
    result?.proposedSchedule.map((w) => [w.date, w]) ?? []
  );

  // Get all unique dates, sorted
  const allDates = result
    ? [
        ...new Set([
          ...result.currentSchedule.map((w) => w.date),
          ...result.forecast.map((f) => f.date),
        ]),
      ].sort()
    : [];

  // Only show dates that have workouts
  const datesWithWorkouts = allDates.filter((d) => currentByDate.has(d));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Optimize for Weather</DialogTitle>
          <DialogDescription>
            Shuffle upcoming workouts to match the forecast — outdoor on sunny
            days, indoor on rainy days.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Fetching forecast & analyzing...</span>
          </div>
        )}

        {applied && (
          <div className="flex items-center justify-center py-8 gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span>Schedule updated!</span>
          </div>
        )}

        {result && !applied && (
          <div className="space-y-2">
            {datesWithWorkouts.map((date) => {
              const forecast = forecastMap.get(date);
              const current = currentByDate.get(date);
              const proposed = proposedByDate.get(date);
              const changed =
                current && proposed && current.id !== proposed.id;

              return (
                <div
                  key={date}
                  className={`rounded-lg border p-3 space-y-1.5 ${
                    changed
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {format(parseISO(date), "EEE, MMM d")}
                    </div>
                    {forecast && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getWeatherIcon(forecast.conditionAm)}
                          <span>{forecast.temperatureAm}°</span>
                          <span className="text-[10px]">AM</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {getWeatherIcon(forecast.conditionPm)}
                          <span>{forecast.temperaturePm}°</span>
                          <span className="text-[10px]">PM</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {forecast && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getScoreColor(
                            scoreFromForecast(forecast)
                          )}`}
                          style={{
                            width: `${scoreFromForecast(forecast)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-6">
                        {scoreFromForecast(forecast)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {current && <WorkoutTypeBadge type={current.type} />}
                    {changed && (
                      <>
                        <ArrowRight className="h-3 w-3 text-blue-500" />
                        {proposed && (
                          <WorkoutTypeBadge type={proposed.type} />
                        )}
                      </>
                    )}
                    {!changed && (
                      <span className="text-[10px] text-muted-foreground">
                        no change
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {result.proposals.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Your schedule already looks good for the weather!
              </div>
            )}
          </div>
        )}

        {result && !applied && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={
                result.proposals.length === 0 || applying
              }
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apply {result.proposals.length} swap
              {result.proposals.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Import the scoring function for display
import { scoreOutdoorSuitability } from "../../convex/lib/weatherOptimizer";

function scoreFromForecast(forecast: {
  conditionAm: string;
  conditionPm: string;
  temperatureAm: number;
  temperaturePm: number;
  precipitationAm: number;
  precipitationPm: number;
  windSpeedAm: number;
  windSpeedPm: number;
}): number {
  return scoreOutdoorSuitability({
    date: "",
    ...forecast,
  });
}
