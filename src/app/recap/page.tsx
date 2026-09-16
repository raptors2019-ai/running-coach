import { Suspense } from "react";
import { CountdownBadge } from "@/components/countdown-badge";
import { WeekRecapView } from "@/components/week-recap-view";

export default function RecapPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Week Recap</h1>
        <CountdownBadge />
      </div>
      <p className="text-sm text-muted-foreground">
        The week as a post — every run you actually did, ready for the story.
      </p>
      <Suspense fallback={<div className="h-[520px] bg-muted animate-pulse rounded-xl" />}>
        <WeekRecapView />
      </Suspense>
    </div>
  );
}
