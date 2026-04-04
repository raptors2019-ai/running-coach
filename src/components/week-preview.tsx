"use client";

import { Doc } from "../../convex/_generated/dataModel";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS, PLAN_START_DATE } from "@/lib/constants";
import { format, parseISO, addDays, subDays } from "date-fns";
import { getLocalDateString, formatDistance } from "@/lib/pace-utils";
import { isNonRunningType } from "@/lib/constants";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Timer, Zap } from "lucide-react";
import { WorkoutDetailDialog } from "./workout-detail-dialog";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { useState } from "react";

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
  upper_body: "bg-indigo-500",
  lower_body: "bg-pink-500",
  swim: "bg-cyan-500",
  cross_training: "bg-orange-500",
  recovery: "bg-emerald-500",
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
  upper_body: "bg-indigo-50 border-indigo-200",
  lower_body: "bg-pink-50 border-pink-200",
  swim: "bg-cyan-50 border-cyan-200",
  cross_training: "bg-orange-50 border-orange-200",
  recovery: "bg-emerald-50 border-emerald-200",
};

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface WeekPreviewProps {
  workouts: Doc<"workouts">[];
}

export function WeekPreview({ workouts }: WeekPreviewProps) {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Calculate the 7-day window based on offset
  const baseDate = new Date(today + "T12:00:00");
  const windowStart = addDays(baseDate, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => toDateString(addDays(windowStart, i)));

  // Navigation bounds
  const canGoBack = days[0] > PLAN_START_DATE;
  const canGoForward = weekOffset < 0;

  // Map workouts by date
  const workoutsByDate = new Map<string, Doc<"workouts">[]>();
  for (const w of workouts) {
    const group = workoutsByDate.get(w.date) || [];
    group.push(w);
    workoutsByDate.set(w.date, group);
  }

  // Selected day's workout
  const selectedWorkouts = workoutsByDate.get(selectedDate) || [];
  const selectedPlanned = selectedWorkouts.find((w) => !w.isUnplanned) || selectedWorkouts[0] || null;
  const isRestDay = selectedPlanned ? isNonRunningType(selectedPlanned.type) : true;

  return (
    <div className="space-y-3">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">This Week</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            disabled={!canGoBack}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={!canGoForward}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date) => {
          const dayWorkouts = workoutsByDate.get(date) || [];
          const planned = dayWorkouts.find((w) => !w.isUnplanned) || dayWorkouts[0] || null;
          const extraCount = dayWorkouts.filter((w) => w !== planned).length;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const type = planned?.type || "rest";
          const bgColor = BG_COLORS[type] || "bg-gray-50 border-gray-200";
          const dotColor = DOT_COLORS[type] || "bg-gray-300";

          return (
            <button
              key={date}
              className={`relative flex flex-col items-center rounded-lg border p-1.5 transition-all ${bgColor} ${
                isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
              } ${isToday && !isSelected ? "ring-1 ring-blue-300" : ""} cursor-pointer hover:shadow-sm`}
              onClick={() => setSelectedDate(date)}
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
              {planned?.completed && (
                <CheckCircle2 className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-green-600 bg-white rounded-full" />
              )}
              {planned && (
                <span className="text-[8px] mt-0.5 text-center leading-tight truncate w-full">
                  {WORKOUT_TYPE_LABELS[type] || type}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedPlanned ? (
        <div
          className={`rounded-lg border p-4 space-y-2 cursor-pointer transition-shadow hover:shadow-md ${
            selectedPlanned.completed ? "border-green-200 bg-green-50/50" : ""
          } ${selectedPlanned.type === "race" ? "border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50" : ""}`}
          onClick={() => setDialogOpen(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selectedPlanned.title}</span>
              <WorkoutTypeBadge type={selectedPlanned.type} />
            </div>
            {selectedPlanned.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <span className="text-xs text-muted-foreground">
                {format(parseISO(selectedDate), "EEEE, MMM d")}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{selectedPlanned.description}</p>

          {selectedPlanned.type !== "rest" && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {selectedPlanned.targetDistance && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatDistance(selectedPlanned.targetDistance)}
                </div>
              )}
              {selectedPlanned.targetPace && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {selectedPlanned.targetPace}/km
                </div>
              )}
              {selectedPlanned.intervals && selectedPlanned.intervals.length > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {selectedPlanned.intervals[0].reps}x{selectedPlanned.intervals[0].distance}
                </div>
              )}
            </div>
          )}

          {selectedPlanned.completed && (selectedPlanned.actualPace || selectedPlanned.actualDuration || selectedPlanned.actualDistance) && (
            <div className="pt-2 border-t border-green-200">
              <div className="flex gap-4 text-sm text-green-700">
                {selectedPlanned.actualDistance && (
                  <span>{formatDistance(selectedPlanned.actualDistance)}</span>
                )}
                {selectedPlanned.actualPace && <span>{selectedPlanned.actualPace}/km</span>}
                {selectedPlanned.actualDuration && (
                  <span>
                    {selectedPlanned.actualDuration >= 3600
                      ? `${Math.floor(selectedPlanned.actualDuration / 3600)}:${String(Math.floor((selectedPlanned.actualDuration % 3600) / 60)).padStart(2, "0")}:${String(selectedPlanned.actualDuration % 60).padStart(2, "0")}`
                      : `${Math.floor(selectedPlanned.actualDuration / 60)}:${String(selectedPlanned.actualDuration % 60).padStart(2, "0")}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-center text-muted-foreground text-sm">
          No workout scheduled for {format(parseISO(selectedDate), "EEEE, MMM d")}.
        </div>
      )}

      {selectedPlanned && (
        <WorkoutDetailDialog
          workout={selectedPlanned}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
