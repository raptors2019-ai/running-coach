"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronLeft, ChevronRight, Download, RefreshCw, RotateCcw, Shuffle, Video } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  layoutOverlay,
  layoutStickers,
  monthLabel,
  monthRange,
  overlayTotals,
  shiftMonth,
  type OverlayMode,
  type OverlayRoute,
  type OverlayTotals,
} from "@/lib/route-overlay";
import { recordStickerVideo } from "@/lib/sticker-video";
import {
  DRAW_SECONDS,
  OVERLAY_AREA,
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  RouteOverlaySvg,
  RouteStickersSvg,
  TOTALS_CARD,
  staggerSeconds,
} from "@/components/route-overlay-svg";

/** Strava activity types that count as a run. */
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

type ViewMode = OverlayMode | "stickers";

const MODES: { key: ViewMode; label: string }[] = [
  { key: "stickers", label: "Stickers" },
  { key: "map", label: "On the map" },
  { key: "stacked", label: "Same start" },
];

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

  const [mode, setMode] = useState<ViewMode>("stickers");
  const [seed, setSeed] = useState(1);
  const [showTotals, setShowTotals] = useState(true);
  const [runsOnly, setRunsOnly] = useState(true);
  const [recording, setRecording] = useState<number | null>(null); // 0..1 while recording
  const [recordError, setRecordError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSynced = useRef<string | null>(null);

  const routes: OverlayRoute[] = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => !runsOnly || RUN_TYPES.has(r.type))
        .map((r) => ({
        id: r.stravaId,
        name: r.name,
        date: r.date,
        distance: r.distance,
        duration: r.duration,
        polyline: r.polyline,
      })),
    [rows, runsOnly]
  );
  const otherCount = (rows ?? []).filter((r) => !RUN_TYPES.has(r.type)).length;

  const overlayMode: OverlayMode = mode === "stickers" ? "map" : mode;
  const layout = useMemo(
    () => layoutOverlay(routes, { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, mode: overlayMode, area: OVERLAY_AREA }),
    [routes, overlayMode]
  );
  const stickers = useMemo(
    () =>
      layoutStickers(routes, {
        width: OVERLAY_WIDTH,
        height: OVERLAY_HEIGHT,
        seed,
        reserve: showTotals ? TOTALS_CARD : undefined,
      }),
    [routes, seed, showTotals]
  );
  const monthTotals = useMemo(() => ({ ...overlayTotals(routes), title: label }), [routes, label]);
  const stickerTotals = showTotals ? monthTotals : undefined;
  const isStickers = mode === "stickers";
  const hasDrawing = isStickers ? stickers.stickers.length > 0 : layout.paths.length > 0;
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

  const download = (transparent = false) => {
    const svg = renderToStaticMarkup(
      isStickers ? (
        <RouteStickersSvg layout={stickers} totals={stickerTotals} transparent={transparent} title={label} />
      ) : (
        <RouteOverlaySvg layout={layout} totals={totals} title={label} />
      )
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
      a.download = `routes-${month}${isStickers ? "-stickers" : ""}${transparent ? "-transparent" : ""}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  const record = async () => {
    setRecordError(null);
    setRecording(0);
    try {
      const video = await recordStickerVideo({
        layout: stickers,
        totals: stickerTotals,
        onProgress: setRecording,
      });
      const url = URL.createObjectURL(video.blob);
      const a = document.createElement("a");
      a.download = `routes-${month}.${video.extension}`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : "Recording failed");
    } finally {
      setRecording(null);
    }
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
        {rows === undefined ? null : !hasDrawing ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-400 px-8 text-center">
            {syncing ? "Pulling routes from Strava…" : `No routes for ${label} yet.`}
          </div>
        ) : isStickers ? (
          <RouteStickersSvg
            key={`${replayKey}-${seed}-${showTotals}`}
            layout={stickers}
            totals={stickerTotals}
            title={label}
            animate
            className="w-full h-full"
          />
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

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === m.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setReplayKey((k) => k + 1)} disabled={!hasDrawing}>
          <RotateCcw /> Replay
        </Button>
        {isStickers ? (
          <Button variant="outline" size="sm" onClick={() => setSeed((n) => n + 1)} disabled={!hasDrawing}>
            <Shuffle /> Shuffle
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing || !stravaAuth}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing" : "Sync Strava"}
          </Button>
        )}
        <Button size="sm" onClick={() => download(false)} disabled={!hasDrawing}>
          <Download /> PNG
        </Button>
        {isStickers ? (
          <Button size="sm" variant="secondary" onClick={() => download(true)} disabled={!hasDrawing}>
            <Download /> Transparent PNG
          </Button>
        ) : null}
        {isStickers ? (
          <Button variant="outline" size="sm" onClick={() => setShowTotals((v) => !v)} disabled={!hasDrawing}>
            {showTotals ? "Hide totals" : "Show totals"}
          </Button>
        ) : null}
        {isStickers ? (
          <Button size="sm" variant="secondary" onClick={record} disabled={!hasDrawing || recording !== null}>
            <Video /> {recording === null ? "Record video" : `Recording ${Math.round(recording * 100)}%`}
          </Button>
        ) : null}
        {isStickers ? (
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing || !stravaAuth}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing" : "Sync Strava"}
          </Button>
        ) : null}
      </div>

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      {recordError && <p className="text-sm text-destructive">{recordError}</p>}
      {recording !== null && (
        <p className="text-xs text-muted-foreground">Recording in real time, keep this tab open until it finishes.</p>
      )}
      {stravaAuth === null && <p className="text-sm text-muted-foreground">Connect Strava in Settings to pull routes.</p>}
      {!isStickers && layout.away.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {layout.away.length} run{layout.away.length === 1 ? "" : "s"} elsewhere not on the map
          {" "}({layout.away.map((r) => r.name).join(", ")}). Switch to &ldquo;Same start&rdquo; to include them.
        </p>
      )}
      {otherCount > 0 && (
        <button
          type="button"
          onClick={() => setRunsOnly((v) => !v)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          {runsOnly
            ? `Runs only. Include ${otherCount} ride${otherCount === 1 ? "" : "s"}/walk${otherCount === 1 ? "" : "s"} too`
            : "Showing rides and walks too. Runs only"}
        </button>
      )}
      {routes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {routes.length} run{routes.length === 1 ? "" : "s"} with GPS, {range.start} to {range.end}.
          {isStickers
            ? " One sticker per run, bigger for longer runs. Transparent PNG drops onto a video; Record video gives the pop-in on black, use a Screen blend to key it out."
            : " Each route draws in on its own; routes you repeat glow brighter."}
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
