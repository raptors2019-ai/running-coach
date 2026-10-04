"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronLeft, ChevronRight, Download, RefreshCw, RotateCcw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  layoutOverlay,
  monthLabel,
  monthRange,
  overlayTotals,
  shiftMonth,
  type OverlayMode,
  type OverlayRoute,
  type OverlayTotals,
} from "@/lib/route-overlay";
import {
  DRAW_SECONDS,
  OVERLAY_AREA,
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  RouteOverlaySvg,
  staggerSeconds,
} from "@/components/route-overlay-svg";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month a recap is most likely wanted for: last month until the 7th. */
function defaultMonth(): string {
  const now = new Date();
  return now.getDate() <= 7 ? shiftMonth(currentMonth(), -1) : currentMonth();
}

export default function OverlayPage() {
  return (
    <Suspense fallback={null}>
      <OverlayPageInner />
    </Suspense>
  );
}

function OverlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("month") ?? defaultMonth();
  const range = monthRange(month);
  const label = monthLabel(month);

  const stravaAuth = useQuery(api.strava.getStravaAuth);
  const rows = useQuery(api.routes.routesInRange, range);
  const syncRoutes = useAction(api.routes.syncRoutes);

  const [mode, setMode] = useState<OverlayMode>("map");
  const [replayKey, setReplayKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSynced = useRef<string | null>(null);

  const routes: OverlayRoute[] = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        id: r.stravaId,
        name: r.name,
        date: r.date,
        distance: r.distance,
        duration: r.duration,
        polyline: r.polyline,
      })),
    [rows]
  );

  const layout = useMemo(
    () => layoutOverlay(routes, { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, mode, area: OVERLAY_AREA }),
    [routes, mode]
  );
  const drawn = useMemo(
    () => layout.paths.map((p) => ({ distance: p.distance, duration: p.duration })),
    [layout]
  );
  const totals = useMemo(() => overlayTotals(drawn), [drawn]);
  const shownTotals = useDrawnTotals(drawn, replayKey);

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncRoutes(range);
      setReplayKey((k) => k + 1);
    } catch (err) {
      setSyncError(err instanceof Error ? friendlyStravaError(err.message) : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Pull a month once if nothing is cached for it yet.
  useEffect(() => {
    if (!stravaAuth || rows === undefined || rows.length > 0) return;
    if (autoSynced.current === month) return;
    autoSynced.current = month;
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stravaAuth, rows, month]);

  const setMonth = (next: string) => {
    router.replace(`/overlay?month=${next}`);
    setReplayKey((k) => k + 1);
  };

  const download = () => {
    const svg = renderToStaticMarkup(
      <RouteOverlaySvg layout={layout} totals={totals} title={label} />
    ).replace("var(--font-geist-sans), ", "");
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OVERLAY_WIDTH;
      canvas.height = OVERLAY_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `routes-${month}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  const isFuture = month >= currentMonth();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Routes</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium w-32 text-center">{label}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isFuture} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-[#0B0B0D] aspect-[9/16] shadow-lg">
        {rows === undefined ? null : layout.paths.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-400 px-8 text-center">
            {syncing ? "Pulling routes from Strava…" : `No routes for ${label} yet.`}
          </div>
        ) : (
          <RouteOverlaySvg
            key={replayKey}
            layout={layout}
            totals={totals}
            shownTotals={shownTotals}
            title={label}
            animate
            className="w-full h-full"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setReplayKey((k) => k + 1)} disabled={layout.paths.length === 0}>
          <RotateCcw /> Replay
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMode(mode === "map" ? "stacked" : "map")}
          disabled={routes.length === 0}
        >
          {mode === "map" ? "Same start" : "On the map"}
        </Button>
        <Button variant="outline" size="sm" onClick={sync} disabled={syncing || !stravaAuth}>
          <RefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing" : "Sync Strava"}
        </Button>
        <Button size="sm" onClick={download} disabled={layout.paths.length === 0}>
          <Download /> PNG
        </Button>
      </div>

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      {stravaAuth === null && <p className="text-sm text-muted-foreground">Connect Strava in Settings to pull routes.</p>}
      {layout.away.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {layout.away.length} run{layout.away.length === 1 ? "" : "s"} elsewhere not on the map
          {" "}({layout.away.map((r) => r.name).join(", ")}). Switch to &ldquo;Same start&rdquo; to include them.
        </p>
      )}
      {routes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {routes.length} run{routes.length === 1 ? "" : "s"} with GPS, {range.start} to {range.end}.
          Each route draws in on its own; routes you repeat glow brighter.
        </p>
      )}
    </div>
  );
}

function friendlyStravaError(message: string): string {
  if (/inactive/i.test(message)) {
    return "Strava has marked the API app inactive (a Strava subscription is now required on the account that owns the app). Reactivate it at strava.com/settings/api, then sync again.";
  }
  return message;
}

/**
 * Totals that count up as routes finish drawing, on the same schedule as
 * the SVG animation. Falls back to the final totals once it is done.
 */
function useDrawnTotals(
  drawn: { distance: number; duration: number }[],
  replayKey: number
): OverlayTotals {
  const [shown, setShown] = useState<OverlayTotals>({ runs: 0, km: 0, seconds: 0 });

  useEffect(() => {
    const n = drawn.length;
    const stagger = staggerSeconds(n);
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // A route counts once it is mostly drawn.
      const done = Math.min(n, Math.max(0, Math.floor((t - DRAW_SECONDS * 0.6) / Math.max(stagger, 1e-6)) + 1));
      setShown(overlayTotals(drawn.slice(0, stagger === 0 ? (t > DRAW_SECONDS * 0.6 ? n : 0) : done)));
      if (done < n || (stagger === 0 && t <= DRAW_SECONDS * 0.6)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drawn, replayKey]);

  return shown;
}
