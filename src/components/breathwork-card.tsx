"use client";

import Link from "next/link";
import { Wind, ChevronRight } from "lucide-react";
import { Doc } from "../../convex/_generated/dataModel";
import { getLocalDateString } from "@/lib/pace-utils";
import { dayKind, dailyRoutine } from "@/lib/breathwork";

/** Today's 15 minutes, chosen by what's on the plan today. */
export function BreathworkCard({ workouts }: { workouts: Doc<"workouts">[] }) {
  const today = getLocalDateString();
  const todays = workouts.filter((w) => w.date === today);
  const planned = todays.find((w) => !w.isUnplanned) ?? null;
  const routine = dailyRoutine(dayKind(planned));

  return (
    <Link
      href="/breathwork"
      className="block rounded-lg border border-sky-200 bg-sky-50/60 p-3 hover:bg-sky-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Wind className="h-4 w-4 text-sky-600 shrink-0" />
        <span className="text-sm font-semibold">Today&apos;s breathwork</span>
        <span className="ml-auto text-xs text-sky-700">{routine.dedicatedMinutes} min</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{routine.focus}</p>
      <ul className="mt-2 space-y-0.5">
        {routine.blocks.map((b) => (
          <li key={b.drill + b.label} className="text-xs flex gap-2">
            <span className="w-10 shrink-0 text-sky-700 tabular-nums">
              {b.minutes ? `${b.minutes} min` : "in run"}
            </span>
            <span>{b.label}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
