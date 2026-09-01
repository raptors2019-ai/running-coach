"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { WeekCard } from "./week-card";
import { WorkoutDetailDialog } from "./workout-detail-dialog";
import { useState } from "react";

export function WorkoutCalendar() {
  const allWorkouts = useQuery(api.workouts.getAllWorkouts);
  const plan = useQuery(api.workouts.getTrainingPlan);
  const swapWorkoutDates = useMutation(api.workouts.swapWorkoutDates);
  const [selectedWorkout, setSelectedWorkout] = useState<Doc<"workouts"> | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  if (!allWorkouts || !plan) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  // Scope to the current plan — kept history from previous race blocks
  // shares week numbers but belongs to an older planId.
  const workouts = allWorkouts.filter((w) => w.planId === plan._id);

  const weeks = workouts.reduce(
    (acc, workout) => {
      const week = workout.weekNumber;
      if (!acc[week]) acc[week] = [];
      acc[week].push(workout);
      return acc;
    },
    {} as Record<number, Doc<"workouts">[]>
  );

  const weekLabels: Record<number, string> = {
    0: "Pre-plan - Where you started",
    1: "Week 1 - Rebuild + Benchmark",
    2: "Week 2 - Raw Speed",
    3: "Week 3 - VO2max",
    4: "Week 4 - Race Pace Test",
    5: "Week 5 - Sharpen",
    6: "Week 6 - Taper + Race",
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    await swapWorkoutDates({
      workoutId1: active.id as Id<"workouts">,
      workoutId2: over.id as Id<"workouts">,
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {Object.entries(weeks)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([weekNum, weekWorkouts]) => (
            <WeekCard
              key={weekNum}
              weekNum={Number(weekNum)}
              weekLabel={weekLabels[Number(weekNum)] || `Week ${weekNum}`}
              workouts={weekWorkouts}
              onSelectWorkout={setSelectedWorkout}
            />
          ))}

        {selectedWorkout && (
          <WorkoutDetailDialog
            workout={selectedWorkout}
            open={!!selectedWorkout}
            onOpenChange={(open) => !open && setSelectedWorkout(null)}
          />
        )}
      </div>
    </DndContext>
  );
}
