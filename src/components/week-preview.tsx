"use client";

import { Doc } from "../../convex/_generated/dataModel";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { format, parseISO, addDays } from "date-fns";
import { getLocalDateString } from "@/lib/pace-utils";
import { CheckCircle2 } from "lucide-react";
import { WorkoutDetailDialog } from "./workout-detail-dialog";
import { useState } from "react";

// Map workout types to solid dot colors for the calendar
const DOT_COLORS: Record<string, string> = {
  easy: "bg-green-500",
  tempo: "bg-yellow-500",
  intervals: "bg-red-500",
  long: "bg-blue-500",
  rest: "bg-gray-300",
  basketball: "bg-orange-500",
  race: "bg-purple-500",
  shakeout: "bg-teal-500",
  race_pace: "bg-amber-500",
};

const BG_COLORS: Record<string, string> = {
  easy: "bg-green-50 border-green-200",
  tempo: "bg-yellow-50 border-yellow-200",
  intervals: "bg-red-50 border-red-200",
  long: "bg-blue-50 border-blue-200",
  rest: "bg-gray-50 border-gray-200",
  basketball: "bg-orange-50 border-orange-200",
  race: "bg-purple-50 border-purple-200",
  shakeout: "bg-teal-50 border-teal-200",
  race_pace: "bg-amber-50 border-amber-200",
};

interface WeekPreviewProps {
  workouts: Doc<"workouts">[];
}

export function WeekPreview({ workouts }: WeekPreviewProps) {
  const today = getLocalDateString();
  const [selectedWorkout, setSelectedWorkout] = useState<Doc<"workouts"> | null>(null);

  // Find current workout to determine the week
  const todayWorkout = workouts.find((w) => w.date === today);
  const currentWeek = todayWorkout?.weekNumber;

  // Get the next 7 days of workouts
  const todayDate = new Date();
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayDate, i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const weekWorkouts = next7Days.map((date) => {
    const dayWorkouts = workouts.filter((w) => w.date === date);
    const planned = dayWorkouts.find((w) => !w.isUnplanned) || dayWorkouts[0] || null;
    const extras = dayWorkouts.filter((w) => w !== planned);
    return { date, workout: planned, extraCount: extras.length };
  });

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">This Week</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {weekWorkouts.map(({ date, workout, extraCount }) => {
          const isToday = date === today;
          const type = workout?.type || "rest";
          const bgColor = BG_COLORS[type] || "bg-gray-50 border-gray-200";
          const dotColor = DOT_COLORS[type] || "bg-gray-300";

          return (
            <button
              key={date}
              className={`relative flex flex-col items-center rounded-lg border p-1.5 transition-all ${bgColor} ${
                isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""
              } ${workout ? "cursor-pointer hover:shadow-sm" : "cursor-default"}`}
              onClick={() => workout && setSelectedWorkout(workout)}
              disabled={!workout}
            >
              <span className={`text-[10px] font-medium ${isToday ? "text-blue-600" : "text-muted-foreground"}`}>
                {format(parseISO(date), "EEE")}
              </span>
              <span className={`text-xs font-bold ${isToday ? "text-blue-700" : ""}`}>
                {format(parseISO(date), "d")}
              </span>
              <div className="flex items-center gap-0.5 mt-1">
                <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                {extraCount > 0 && (
                  <span className="text-[7px] font-bold text-muted-foreground">+{extraCount}</span>
                )}
              </div>
              {workout?.completed && (
                <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-green-600 bg-white rounded-full" />
              )}
              {workout && (
                <span className="text-[8px] mt-0.5 text-center leading-tight truncate w-full">
                  {WORKOUT_TYPE_LABELS[type] || type}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedWorkout && (
        <WorkoutDetailDialog
          workout={selectedWorkout}
          open={!!selectedWorkout}
          onOpenChange={(open) => !open && setSelectedWorkout(null)}
        />
      )}
    </div>
  );
}
