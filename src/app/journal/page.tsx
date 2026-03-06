"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { JournalEntryCard } from "@/components/journal-entry-card";
import { useEffect, useRef } from "react";

export default function JournalPage() {
  const entries = useQuery(api.journal.getAllEntries);
  const generateMissing = useMutation(api.journal.generateMissingEntries);
  const hasGenerated = useRef(false);

  useEffect(() => {
    if (!hasGenerated.current) {
      hasGenerated.current = true;
      generateMissing();
    }
  }, [generateMissing]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Journal</h1>

      {entries === undefined && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No journal entries yet</p>
          <p className="text-sm mt-1">Complete a workout and entries will appear here automatically.</p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry) => (
            <JournalEntryCard key={entry._id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
