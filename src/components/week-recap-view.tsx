"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Check, Copy, Download, RotateCcw, Share2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RECAP_HEIGHT, RECAP_WIDTH, WeekRecapCard } from "@/components/week-recap-card";
import { GOAL_TIME_MINUTES, RACE_DATE, RACE_NAME } from "@/lib/constants";
import { daysUntil } from "@/lib/pace-utils";
import { shareOrDownloadPng, svgToPngBlob } from "@/lib/svg-export";
import {
  buildWeekRecap,
  defaultCaption,
  RecapMode,
  weekHighlight,
  weeksWithRuns,
} from "@/lib/week-recap";

/**
 * Pre-plan weeks all carry week number 0, so they get dated pills instead of
 * seven identical "Pre-plan" chips.
 */
function weekPillLabel(workouts: { date: string; weekNumber: number }[], weekStart: string): string {
  const weekNumber = workouts
    .filter((w) => w.date >= weekStart)
    .filter((w) => w.date <= addSixDays(weekStart))
    .reduce((max, w) => Math.max(max, w.weekNumber), 0);
  if (weekNumber > 0) return `Week ${weekNumber}`;
  return new Date(weekStart + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function addSixDays(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

const GOAL_LABEL = `Sub-${GOAL_TIME_MINUTES} · ${new Date(RACE_DATE + "T12:00:00").toLocaleDateString(
  "en-CA",
  { month: "short", day: "numeric" }
)}`;

export function WeekRecapView() {
  const searchParams = useSearchParams();
  // ?start=YYYY-MM-DD names a calendar week; the plan page links straight to one.
  const weekParam = searchParams.get("start");
  const allWorkouts = useQuery(api.workouts.getAllWorkouts);
  const plan = useQuery(api.workouts.getTrainingPlan);

  const [selectedWeek, setSelectedWeek] = useState<string | null>(weekParam);
  // Null until the athlete types: the caption then follows the week they pick.
  const [captionOverride, setCaptionOverride] = useState<string | null>(null);
  const [mode, setMode] = useState<RecapMode>("runs");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const workouts = useMemo(
    () => (allWorkouts && plan ? allWorkouts.filter((w) => w.planId === plan._id) : []),
    [allWorkouts, plan]
  );
  const weeks = useMemo(() => weeksWithRuns(workouts), [workouts]);

  // Land on the most recent week with runs in it, unless a link named one.
  const week =
    selectedWeek !== null && weeks.includes(selectedWeek) ? selectedWeek : weeks[weeks.length - 1];

  const recap = useMemo(
    () => (week === undefined ? null : buildWeekRecap(workouts, week, mode)),
    [workouts, week, mode]
  );
  const caption = captionOverride ?? (recap ? defaultCaption(recap) : "");

  useEffect(() => setCopied(false), [caption]);

  if (allWorkouts === undefined || plan === undefined) {
    return <div className="h-[520px] bg-muted animate-pulse rounded-xl" />;
  }

  if (!plan || !recap) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No completed runs yet — log a run and your first week card shows up here.
      </p>
    );
  }

  const filename = `${recap.weekStart}-recap${mode === "all" ? "-all" : ""}.png`;

  async function withCard(action: (blob: Blob) => Promise<void> | void) {
    if (!svgRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await svgToPngBlob(svgRef.current, RECAP_WIDTH, RECAP_HEIGHT);
      await action(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the image");
    } finally {
      setBusy(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
    } catch {
      setError("Clipboard is blocked — select the text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {weeks.map((w) => (
          <button
            key={w}
            onClick={() => {
              setSelectedWeek(w);
              setCaptionOverride(null);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              w === week
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {weekPillLabel(workouts, w)}
          </button>
        ))}
      </div>

      <div className="flex rounded-lg border p-0.5 text-sm">
        {([
          ["runs", "Runs only"],
          ["all", "Every session"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <WeekRecapCard
        ref={svgRef}
        recap={recap}
        caption={caption}
        highlight={weekHighlight(recap)}
        raceName={plan.name.split(" - ")[0] || RACE_NAME}
        goalLabel={GOAL_LABEL}
        daysToRace={daysUntil(RACE_DATE)}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="recap-caption" className="text-sm font-medium">
            Caption
          </label>
          {captionOverride !== null && (
            <button
              onClick={() => setCaptionOverride(null)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <Textarea
          id="recap-caption"
          value={caption}
          onChange={(e) => setCaptionOverride(e.target.value)}
          rows={2}
          placeholder="s/o to me for putting in the work"
        />
        <p className="text-xs text-muted-foreground">
          Three lines fit on the card — anything longer gets trimmed there, but the full text
          still copies for the post.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => withCard((blob) => shareOrDownloadPng(blob, filename, caption).then(() => {}))}
          disabled={busy}
          className="w-full"
        >
          <Share2 className="h-4 w-4" /> {busy ? "Rendering…" : "Share"}
        </Button>
        <Button
          variant="outline"
          onClick={() => withCard((blob) => import("@/lib/svg-export").then((m) => m.downloadBlob(blob, filename)))}
          disabled={busy}
          className="w-full"
        >
          <Download className="h-4 w-4" /> Save PNG
        </Button>
        <Button variant="outline" onClick={copyCaption} className="col-span-2 w-full">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Caption copied" : "Copy caption"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
