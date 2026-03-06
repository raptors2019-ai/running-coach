"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useAutoStravaSync() {
  const stravaAuth = useQuery(api.strava.getStravaAuth);
  const lastSyncAt = useQuery(api.strava.getLastSyncTime);
  const syncAndAutoMatch = useAction(api.strava.syncAndAutoMatch);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!stravaAuth || hasFired.current) return;

    const now = Date.now();
    const shouldSync = !lastSyncAt || now - lastSyncAt > ONE_HOUR_MS;

    if (shouldSync) {
      hasFired.current = true;
      syncAndAutoMatch().catch(() => {
        // Fire-and-forget — errors are non-critical
      });
    }
  }, [stravaAuth, lastSyncAt, syncAndAutoMatch]);
}
