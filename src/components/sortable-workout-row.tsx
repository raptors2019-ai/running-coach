"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { formatDistance, getLocalDateString } from "@/lib/pace-utils";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { format, parseISO } from "date-fns";
import { CheckCircle2, GripVertical, Pencil, X, Check } from "lucide-react";
import { useState } from "react";

interface SortableWorkoutRowProps {
  workout: Doc<"workouts">;
  isToday: boolean;
  onSelect: (workout: Doc<"workouts">) => void;
}

const EDITABLE_TYPES = Object.keys(WORKOUT_TYPE_LABELS);

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
        className="w-full px-3 py-2 rounded-md text-sm bg-muted/50 border border-border"
      >
        <div className="flex items-center gap-2">
          <span className="w-16 text-muted-foreground shrink-0">
            {format(parseISO(workout.date), "EEE d")}
          </span>
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="text-sm rounded border border-input bg-background px-2 py-1"
          >
            {EDITABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 min-w-0 text-sm rounded border border-input bg-background px-2 py-1"
          />
          <button
            onClick={handleSaveEdit}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 text-muted-foreground hover:bg-muted rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors hover:bg-muted/70 ${
        isToday ? "bg-blue-50 border border-blue-200" : ""
      } ${workout.completed ? "opacity-75" : ""}`}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-muted-foreground/50 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        className="flex items-center gap-2 flex-1 min-w-0"
        onClick={() => onSelect(workout)}
      >
        {workout.completed ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
        )}
        <span className="w-16 text-muted-foreground shrink-0">
          {format(parseISO(workout.date), "EEE d")}
        </span>
        <WorkoutTypeBadge type={workout.type} className="shrink-0" />
        <span className="truncate">{workout.title}</span>
        {workout.targetDistance && (
          <span className="ml-auto text-muted-foreground shrink-0">
            {formatDistance(workout.targetDistance)}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted rounded shrink-0"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
