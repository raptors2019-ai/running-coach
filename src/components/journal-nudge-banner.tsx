"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getLocalDateString } from "@/lib/pace-utils";

export function JournalNudgeBanner() {
  const today = getLocalDateString();
  const status = useQuery(api.journal.getTodayJournalStatus, { today });

  const currentHour = new Date().getHours();

  if (!status || !status.hasEntry || status.hasNotes || currentHour < 17) {
    return null;
  }

  return (
    <Link
      href="/journal"
      className="block rounded-lg border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 transition-colors"
    >
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-sm">
          Your coach has feedback ready — journal your thoughts to unlock it
        </p>
      </div>
    </Link>
  );
}
