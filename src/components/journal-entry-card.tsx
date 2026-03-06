"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { formatDistance } from "@/lib/pace-utils";
import { format, parseISO } from "date-fns";
import { useState } from "react";

type Mood = "great" | "good" | "okay" | "tired" | "bad";

const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great", emoji: "\u{1F929}", label: "Great" },
  { value: "good", emoji: "\u{1F60A}", label: "Good" },
  { value: "okay", emoji: "\u{1F610}", label: "Okay" },
  { value: "tired", emoji: "\u{1F971}", label: "Tired" },
  { value: "bad", emoji: "\u{1F614}", label: "Bad" },
];

interface JournalEntryCardProps {
  entry: {
    _id: Id<"journalEntries">;
    date: string;
    autoFeedback: string;
    userNotes?: string;
    mood?: Mood;
    workout: Doc<"workouts"> | null;
  };
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(entry.userNotes || "");
  const updateNotes = useMutation(api.journal.updateUserNotes);

  const handleSaveNote = async () => {
    await updateNotes({
      entryId: entry._id,
      userNotes: noteText || undefined,
    });
    setShowNoteInput(false);
  };

  const handleMoodSelect = async (mood: Mood) => {
    await updateNotes({
      entryId: entry._id,
      mood: mood === entry.mood ? undefined : mood,
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">
            {format(parseISO(entry.date), "EEEE, MMMM d")}
          </h3>
          {entry.mood && (
            <span className="text-lg">
              {MOOD_OPTIONS.find((m) => m.value === entry.mood)?.emoji}
            </span>
          )}
        </div>

        {entry.workout && (
          <div className="flex items-center gap-2 text-sm">
            <WorkoutTypeBadge type={entry.workout.type} />
            <span>{entry.workout.title}</span>
            {entry.workout.actualDistance && (
              <span className="text-muted-foreground">
                {formatDistance(entry.workout.actualDistance)}
              </span>
            )}
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          {entry.autoFeedback}
        </div>

        <div className="flex gap-1">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => handleMoodSelect(m.value)}
              className={`flex-1 py-1.5 rounded text-center text-lg transition-colors ${
                entry.mood === m.value
                  ? "bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-muted"
              }`}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        {entry.userNotes && !showNoteInput && (
          <button
            onClick={() => setShowNoteInput(true)}
            className="text-sm text-left w-full bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors"
          >
            {entry.userNotes}
          </button>
        )}

        {!entry.userNotes && !showNoteInput && (
          <button
            onClick={() => setShowNoteInput(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Add a note...
          </button>
        )}

        {showNoteInput && (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="How did this workout feel?"
              className="w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setNoteText(entry.userNotes || "");
                  setShowNoteInput(false);
                }}
                className="text-sm px-3 py-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="text-sm px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
