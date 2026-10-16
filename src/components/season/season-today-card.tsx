"use client";

import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { slotProgress, upNextSlot } from "../../../convex/lib/season";
import { repBars, slotStyle, slotTarget, toGoLabel } from "./slot-style";
import { SlotIcon } from "./slot-icon";
import { KIND_COLORS, RepBars, runLine } from "./week-slots";
import { useSlotSheet } from "./use-slot-sheet";
import type { ActiveSeason } from "./types";

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

/** Today in season mode: runs left this week, the one to do next, and what's done. */
export function SeasonTodayCard({ active }: { active: ActiveSeason }) {
  const week = useQuery(api.seasons.getSeasonWeek, { weekStart: active.weekStart });
  const { open, sheet } = useSlotSheet(week);
  if (!week) return <div className="h-44 animate-pulse rounded-[20px] bg-winter-navy/80" />;

  const progress = slotProgress(week.slots, week.fills);
  const next = upNextSlot(week.slots, week.fills);
  const others = week.slots.filter((s) => s.id !== next?.id && !s.skipped);
  const nextColors = next ? KIND_COLORS[next.kind] : null;

  return (
    <>
      <section className="flex items-center justify-between gap-3 rounded-[20px] bg-winter-navy p-[18px] text-white">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-sun">THIS WEEK</span>
          <h2 className="font-display text-[26px] leading-tight font-extrabold">
            {week.plan ? toGoLabel(progress.done, progress.required, progress.total) : `${week.totals.runs} run${week.totals.runs === 1 ? "" : "s"} so far`}
          </h2>
          <span className="text-xs text-winter-frost">
            {week.plan ? "Resets Monday · no fixed days" : "Your coach sets the week on Monday"}
          </span>
        </div>
        {week.plan && (
          <svg viewBox="0 0 112 112" className="h-28 w-28 shrink-0" role="img" aria-label={`${progress.label} runs done this week`}>
            <circle cx="56" cy="56" r={RING_R} fill="none" stroke="#33407a" strokeWidth="14" />
            <circle
              cx="56"
              cy="56"
              r={RING_R}
              fill="none"
              stroke="#3ddc97"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(progress.total ? progress.done / progress.total : 0) * RING_C} ${RING_C}`}
              transform="rotate(-90 56 56)"
              className="transition-[stroke-dasharray] duration-700"
            />
            <text x="56" y="58" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" className="font-display">
              {progress.done}
            </text>
            <text x="56" y="77" textAnchor="middle" fontSize="12" fill="#c9d3ff">
              of {progress.required === progress.total ? progress.total : `${progress.required}–${progress.total}`}
            </text>
          </svg>
        )}
      </section>

      {next && nextColors && (
        <button
          type="button"
          onClick={() => open(next.id)}
          className={`flex w-full flex-col gap-2.5 rounded-[20px] p-4 text-left text-white ${nextColors.solid}`}
        >
          <span className="flex items-center justify-between text-xs font-bold tracking-wide">
            <span className="flex items-center gap-1.5">
              <SlotIcon name={slotStyle(next, null, true).icon} className="h-4 w-4 text-sun" fill="currentColor" />
              {next.optional ? "BONUS IF IT FITS" : "UP NEXT"}
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl font-extrabold">{next.title}</span>
          {repBars(next) > 0 && <RepBars count={repBars(next)} light />}
          <span className="text-sm font-semibold">{slotTarget(next)}</span>
        </button>
      )}

      {others.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {others.map((s) => {
            const fill = week.fills[s.id];
            const style = slotStyle(s, fill, false);
            const colors = KIND_COLORS[s.kind];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => open(s.id)}
                className={`flex flex-col gap-1.5 rounded-[18px] p-3.5 text-left ${
                  fill ? "bg-slot-done-soft" : "border-2 border-dashed border-winter-line bg-white p-3"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${fill ? "bg-slot-done" : colors.soft}`}>
                  <SlotIcon
                    name={fill ? "check" : style.icon}
                    className={`h-[18px] w-[18px] ${fill ? "text-slot-done-ink" : colors.ink}`}
                    strokeWidth={fill ? 3 : 2.2}
                  />
                </span>
                <span className={`text-sm font-bold ${fill ? "text-slot-done-ink" : "text-[#3b4263]"}`}>
                  {fill ? `${s.title} done` : `${s.title}${s.optional ? " · bonus" : ""}`}
                </span>
                <span className={`text-xs ${fill ? "text-[#2d6b4c]" : "text-winter-muted"}`}>
                  {fill ? `${fill.dayOfWeek.slice(0, 3)} · ${runLine(fill)}` : slotTarget(s)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {sheet}
    </>
  );
}
