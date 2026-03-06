"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ManualEntryFormProps {
  workout: Doc<"workouts">;
  onComplete: () => void;
}

export function ManualEntryForm({ workout, onComplete }: ManualEntryFormProps) {
  const [distance, setDistance] = useState(
    workout.targetDistance?.toString() || ""
  );
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [notes, setNotes] = useState("");

  const markComplete = useMutation(api.workouts.markWorkoutComplete);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const distanceNum = parseFloat(distance);
    const totalSeconds =
      minutes || seconds
        ? (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0)
        : undefined;

    let pace: string | undefined;
    if (distanceNum > 0 && totalSeconds) {
      const paceSeconds = totalSeconds / distanceNum;
      const paceMin = Math.floor(paceSeconds / 60);
      const paceSec = Math.round(paceSeconds % 60);
      pace = `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
    }

    await markComplete({
      workoutId: workout._id,
      actualDistance: distanceNum || undefined,
      actualDuration: totalSeconds,
      actualPace: pace,
      avgHeartRate: heartRate ? parseInt(heartRate) : undefined,
      notes: notes || undefined,
    });

    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="distance" className="text-xs">
            Distance (km)
          </Label>
          <Input
            id="distance"
            type="number"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="5.0"
          />
        </div>
        <div>
          <Label htmlFor="heartrate" className="text-xs">
            Avg HR (bpm)
          </Label>
          <Input
            id="heartrate"
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="155"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Duration</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="35"
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">min</span>
          <Input
            type="number"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            placeholder="00"
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">sec</span>
        </div>
      </div>
      <div>
        <Label htmlFor="notes" className="text-xs">
          Notes
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel?"
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full">
        Save & Complete
      </Button>
    </form>
  );
}
