"use client";

import { PaceChart } from "@/components/pace-chart";
import { WeeklyVolumeChart } from "@/components/weekly-volume-chart";
import { RacePrediction } from "@/components/race-prediction";
import { RecentRuns } from "@/components/recent-runs";
import { CountdownBadge } from "@/components/countdown-badge";
import Link from "next/link";
import { Share2 } from "lucide-react";

export default function ProgressPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Progress</h1>
        <CountdownBadge />
      </div>
      <Link
        href="/recap"
        className="flex items-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-lg font-medium hover:from-orange-700 hover:to-amber-600 transition-colors"
      >
        <Share2 className="h-5 w-5" />
        <div>
          <div className="text-sm font-semibold">Week Recap</div>
          <div className="text-xs text-orange-50">Your week as a shareable card</div>
        </div>
      </Link>
      <RacePrediction />
      <RecentRuns />
      <PaceChart />
      <WeeklyVolumeChart />
    </div>
  );
}
