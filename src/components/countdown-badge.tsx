"use client";

import { daysUntil } from "@/lib/pace-utils";
import { RACE_DATE } from "@/lib/constants";

export function CountdownBadge() {
  const days = daysUntil(RACE_DATE);

  if (days < 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
        Race Complete!
      </div>
    );
  }

  if (days === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-800 animate-pulse">
        RACE DAY!
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
      <span className="font-bold">{days}</span>
      <span>{days === 1 ? "day" : "days"} to race</span>
    </div>
  );
}
