"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { StatusChip } from "./status-chip";
import { formatDistance } from "@/lib/pace-utils";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { format, parseISO } from "date-fns";
import { CheckCircle2, GripVertical, Pencil, X, Check, XCircle } from "lucide-react";
import { useState } from "react";

interface SortableWorkoutRowProps {
  workout: Doc<"workouts">;
  isToday: boolean;
  onSelect: (workout: Doc<"workouts">) => void;
}

// Strava's generic "run" is for imported extras, not something to plan.
const EDITABLE_TYPES = Object.keys(WORKOUT_TYPE_LABELS).filter((t) => t !== "run");

const dayLabel = (date: string) => format(parseISO(date), "EEE d");

export function SortableWorkoutRow({ workout, isToday, onSelect }: SortableWorkoutRowProps) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(workout.type);
  const [editTitle, setEditTitle] = useState(workout.title);
  const updateWorkoutType = useMutation(api.workouts.updateWorkoutType);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveEdit = async () => {
    await updateWorkoutType({
      workoutId: workout._id,
      type: editType,
      title: editTitle,
    });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditType(workout.type);
    setEditTitle(workout.title);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-muted-foreground">{dayLabel(workout.date)}</span>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
            >
              {EDITABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WORKOUT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
            />
            <button
              onClick={handleSaveEdit}
              aria-label="Save"
              className="rounded p-1 text-green-600 hover:bg-green-100"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              aria-label="Cancel"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const missed = !workout.completed && !!workout.missedAt;
  const madeUpOn =
    workout.completedDate && workout.completedDate !== workout.date ? workout.completedDate : null;
  const distance =
    workout.completed && workout.actualDistance
      ? formatDistance(workout.actualDistance)
      : workout.targetDistance
        ? formatDistance(workout.targetDistance)
        : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-start gap-1.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/70 ${
        isToday ? "border border-blue-200 bg-blue-50" : ""
      } ${workout.completed ? "opacity-75" : ""} ${missed ? "opacity-60" : ""}`}
    >
      <button
        className="-ml-1 mt-0.5 touch-none cursor-grab p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
        onClick={() => onSelect(workout)}
      >
        {workout.completed ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : missed ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
        )}
        <span className="w-12 shrink-0 text-xs leading-5 text-muted-foreground">
          {dayLabel(workout.date)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <WorkoutTypeBadge type={workout.type} className="shrink-0" />
            {missed && <StatusChip tone="amber">Missed</StatusChip>}
            {workout.isUnplanned && <StatusChip tone="green">Extra</StatusChip>}
            {madeUpOn && <StatusChip tone="blue">Done {dayLabel(madeUpOn)}</StatusChip>}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 line-clamp-2 leading-tight">{workout.title}</span>
            {distance && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{distance}</span>
            )}
          </div>
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        aria-label="Edit workout"
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
