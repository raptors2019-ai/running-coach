"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { RACE_DATE } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

/**
 * The app's race config lives in constants (deployed with the frontend) while
 * the workout data lives in Convex (deployed separately). If the Convex
 * functions aren't pushed, the countdown shows the new race while the schedule
 * is still the old one — silently, with days reading "Rest" because no workout
 * rows exist. This surfaces that mismatch instead.
 */
export function StalePlanBanner() {
  const plan = useQuery(api.workouts.getTrainingPlan);

  if (!plan || plan.raceDate === RACE_DATE) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-sm text-amber-900">
        <p className="font-medium">Training plan is out of date</p>
        <p className="text-amber-900/80 mt-0.5">
          The app is set up for a race on {RACE_DATE}, but the loaded plan
          &ldquo;{plan.name}&rdquo; targets {plan.raceDate}. Push the latest
          Convex functions, then run{" "}
          <code className="bg-amber-100 px-1 rounded">seed:reseedTrainingPlan</code>.
        </p>
      </div>
    </div>
  );
}
