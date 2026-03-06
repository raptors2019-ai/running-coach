"use client";

import { PaceChart } from "@/components/pace-chart";
import { WeeklyVolumeChart } from "@/components/weekly-volume-chart";
import { RacePrediction } from "@/components/race-prediction";
import { CountdownBadge } from "@/components/countdown-badge";

export default function ProgressPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Progress</h1>
        <CountdownBadge />
      </div>
      <RacePrediction />
      <PaceChart />
      <WeeklyVolumeChart />
    </div>
  );
}
