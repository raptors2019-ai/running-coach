"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

// 15 min: short enough that a run finished before opening the app shows up,
// long enough to stay far from Strava's 200 req / 15 min limit.
const SYNC_THROTTLE_MS = 15 * 60 * 1000;

export function useAutoStravaSync() {
  const stravaAuth = useQuery(api.strava.getStravaAuth);
  const lastSyncAt = useQuery(api.strava.getLastSyncTime);
  const syncAndAutoMatch = useAction(api.strava.syncAndAutoMatch);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!stravaAuth || hasFired.current) return;

    const now = Date.now();
    const shouldSync = !lastSyncAt || now - lastSyncAt > SYNC_THROTTLE_MS;

    if (shouldSync) {
      hasFired.current = true;
      syncAndAutoMatch({}).catch(() => {
        // Fire-and-forget — errors are non-critical
      });
    }
  }, [stravaAuth, lastSyncAt, syncAndAutoMatch]);
}
