"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { WorkoutTypeBadge } from "./workout-type-badge";
import { formatDistance } from "@/lib/pace-utils";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Lock } from "lucide-react";

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
    coachFeedbackUnlocked?: boolean;
    workout: Doc<"workouts"> | null;
  };
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const [noteText, setNoteText] = useState(entry.userNotes || "");
  const [saving, setSaving] = useState(false);
  const updateNotes = useMutation(api.journal.updateUserNotes);

  const isUnlocked = entry.coachFeedbackUnlocked || !!(entry.userNotes?.trim());

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      await updateNotes({
        entryId: entry._id,
        userNotes: noteText || undefined,
      });
    } finally {
      setSaving(false);
    }
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
        {/* Date header + workout badge */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">
            {format(parseISO(entry.date), "EEEE, MMMM d")}
          </h3>
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
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* YOUR REFLECTION */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Reflection
            </h4>

            {/* Mood selector */}
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

            {/* Textarea always visible */}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="How did this workout feel? What went well?"
              className="w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={saving || noteText === (entry.userNotes || "")}
                className="text-sm px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* COACH'S TAKE */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Coach&apos;s Take
            </h4>

            {isUnlocked ? (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground min-h-[80px]">
                {entry.autoFeedback}
              </div>
            ) : (
              <div className="relative min-h-[80px]">
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground blur-[8px] select-none">
                  {entry.autoFeedback}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground text-center px-4">
                    Write your reflection to unlock
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
