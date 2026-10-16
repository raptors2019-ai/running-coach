"use client";

import { WorkoutCalendar } from "@/components/workout-calendar";
import { CountdownBadge } from "@/components/countdown-badge";
import Link from "next/link";
import { BookOpen, Wind } from "lucide-react";
import { useQuery } from "convex/react";
import { getLocalDateString } from "@/lib/pace-utils";
import { api } from "../../../convex/_generated/api";
import { SeasonPlanView } from "@/components/season/season-plan-view";
import { SeasonBadge } from "@/components/season/season-badge";

export default function PlanPage() {
  const active = useQuery(api.seasons.getActiveSeason, { today: getLocalDateString() });
  // Hold the page until we know which mode it's in, so the race plan never flashes.
  if (active === undefined) return <div className="min-h-screen" />;

  if (active) {
    return (
      <div className="min-h-screen space-y-[18px] bg-winter-snow p-4 text-winter-ink">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">Plan</h1>
          <SeasonBadge />
        </div>
        <SeasonPlanView active={active} />
        <PlanLinks />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Training Plan</h1>
        <CountdownBadge />
      </div>
      <PlanLinks />
      <WorkoutCalendar />
    </div>
  );
}

function PlanLinks() {
  return (
    <>
      <Link
        href="/gameplan"
        className="flex items-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors"
      >
        <BookOpen className="h-5 w-5" />
        <div>
          <div className="text-sm font-semibold">View Full Game Plan</div>
          <div className="text-xs text-blue-100">Week-by-week strategy, philosophy &amp; race plan</div>
        </div>
      </Link>
      <Link
        href="/breathwork"
        className="flex items-center gap-2 w-full px-4 py-3 border border-sky-200 bg-sky-50/60 rounded-lg hover:bg-sky-50 transition-colors"
      >
        <Wind className="h-5 w-5 text-sky-600" />
        <div>
          <div className="text-sm font-semibold">Breathwork</div>
          <div className="text-xs text-muted-foreground">15 min a day: off feet, zone 2, hard runs &amp; race day</div>
        </div>
      </Link>
    </>
  );
}
