"use client";

import { Doc } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutTypeBadge } from "./workout-type-badge";
import type { WeekStats } from "./week-stats-grid";
import { isNonRunningType, RUNNING_TYPES, WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { formatDistance } from "@/lib/pace-utils";
import { format, parseISO, addDays } from "date-fns";
import {
  CalendarRange,
  CheckCircle2,
  XCircle,
  Target,
  BellRing,
  Loader2,
  RefreshCw,
} from "lucide-react";

export type WeekLookahead = {
  lookahead?: string;
  targets?: string[];
  reminders?: string[];
};

interface WeekAheadCardProps {
  weekStart: string;
  today: string;
  workouts: Doc<"workouts">[];
  stats: WeekStats;
  /** The look-ahead section of the latest weekly review, if one exists. */
  lookahead: WeekLookahead | null;
  onGenerate: () => void;
  generating: boolean;
}

function weekLabel(weekStart: string): string {
  const start = parseISO(weekStart);
  return `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d")}`;
}

/** Synced rows store pace as "7:17/km", hand-entered ones as "7:17". Normalize. */
function perKm(pace: string): string {
  return pace.endsWith("/km") ? pace : `${pace}/km`;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isSegment = (w: Doc<"workouts">) => w.title.startsWith("Warmup —") || w.title.startsWith("Cooldown —");
const isLoggedRun = (w: Doc<"workouts">) =>
  w.completed && !!w.actualDistance && (RUNNING_TYPES.has(w.type) || w.type === "run");

function DayRow({ date, workouts, today }: { date: string; workouts: Doc<"workouts">[]; today: string }) {
  const planned = workouts.find((w) => !w.isUnplanned) ?? workouts[0] ?? null;
  // Runs synced from Strava that weren't on the plan (a lift day with a jog,
  // a second run). Warmup/cooldown segments belong to the planned session.
  const extraRuns = workouts.filter((w) => w !== planned && isLoggedRun(w) && !isSegment(w));
  const isToday = date === today;
  const isPast = date < today;
  const type = planned?.type ?? "rest";
  const offDay = !planned || isNonRunningType(type);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 ${
        isToday ? "border-blue-300 bg-blue-50/70" : "border-muted"
      } ${isPast && !isToday ? "opacity-70" : ""}`}
    >
      <div className="text-center w-9 shrink-0">
        <div className={`text-[10px] font-medium ${isToday ? "text-blue-600" : "text-muted-foreground"}`}>
          {format(parseISO(date), "EEE")}
        </div>
        <div className={`text-sm font-bold ${isToday ? "text-blue-700" : ""}`}>{format(parseISO(date), "d")}</div>
      </div>

      <div className="flex-1 min-w-0">
        {offDay ? (
          <>
            <div className="text-sm text-muted-foreground">
              {planned ? WORKOUT_TYPE_LABELS[type] ?? planned.title : "Rest"}
            </div>
            {extraRuns.length > 0 && (
              <div className="text-xs text-green-700 mt-0.5">
                {extraRuns.map((w) => `${formatDistance(w.actualDistance!)} run${w.actualPace ? ` · ${perKm(w.actualPace)}` : ""}`).join(", ")}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-sm font-medium truncate">{planned.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {planned.completed ? (
                <span className="text-green-700">
                  {planned.actualDistance ? formatDistance(planned.actualDistance) : null}
                  {planned.actualDistance && planned.actualPace ? " · " : null}
                  {planned.actualPace ? perKm(planned.actualPace) : null}
                </span>
              ) : (
                <>
                  {planned.targetDistance ? formatDistance(planned.targetDistance) : null}
                  {planned.targetDistance && planned.targetPace ? " · " : null}
                  {planned.targetPace ? perKm(planned.targetPace) : null}
                  {planned.intervals?.[0]
                    ? `${planned.targetDistance || planned.targetPace ? " · " : ""}${planned.intervals[0].reps}x${planned.intervals[0].distance}`
                    : null}
                </>
              )}
              {extraRuns.length > 0 && (
                <span>
                  {" "}· +{extraRuns.map((w) => formatDistance(w.actualDistance!)).join(", ")} logged
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {planned && !offDay && <WorkoutTypeBadge type={type} className="shrink-0 text-[10px]" />}
      <div className="w-4 shrink-0 flex justify-center">
        {planned?.completed || (offDay && extraRuns.length > 0) ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : planned?.missedAt ? (
          <XCircle className="h-4 w-4 text-amber-500" />
        ) : null}
      </div>
    </div>
  );
}

function CoachList({
  icon,
  title,
  items,
  headingClass,
  dotClass,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  headingClass: string;
  dotClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${headingClass}`}>
        {icon}
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm flex gap-2">
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The coming week at a glance: every day of the plan with what's done so
 * far, then the coach's look-ahead, targets, and reminders from the latest
 * weekly review.
 */
export function WeekAheadCard({
  weekStart,
  today,
  workouts,
  stats,
  lookahead,
  onGenerate,
  generating,
}: WeekAheadCardProps) {
  const base = new Date(weekStart + "T12:00:00");
  const days = Array.from({ length: 7 }, (_, i) => toDateString(addDays(base, i)));
  const byDate = new Map<string, Doc<"workouts">[]>();
  for (const w of workouts) {
    const group = byDate.get(w.date) ?? [];
    group.push(w);
    byDate.set(w.date, group);
  }

  const hasCoachNotes =
    !!lookahead &&
    (!!lookahead.lookahead || (lookahead.targets?.length ?? 0) > 0 || (lookahead.reminders?.length ?? 0) > 0);

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-blue-600" />
            Week Ahead
          </span>
          <span className="text-xs font-normal text-muted-foreground">{weekLabel(weekStart)}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          So far: {stats.runsCompleted}/{stats.runsPlanned} runs · {stats.actualKm}/{stats.plannedKm} km
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          {days.map((date) => (
            <DayRow key={date} date={date} today={today} workouts={byDate.get(date) ?? []} />
          ))}
        </div>

        {hasCoachNotes ? (
          <div className="space-y-4 border-t border-blue-100 pt-3">
            {lookahead.lookahead && <p className="text-sm whitespace-pre-wrap">{lookahead.lookahead}</p>}
            <CoachList
              icon={<Target className="h-3.5 w-3.5" />}
              title="Targets"
              items={lookahead.targets ?? []}
              headingClass="text-blue-700"
              dotClass="bg-blue-600"
            />
            <CoachList
              icon={<BellRing className="h-3.5 w-3.5" />}
              title="Don't forget"
              items={lookahead.reminders ?? []}
              headingClass="text-amber-700"
              dotClass="bg-amber-500"
            />
          </div>
        ) : (
          <div className="border-t border-blue-100 pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              The coach sets targets for the week in Monday morning&apos;s review.
            </p>
            <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Write it now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
