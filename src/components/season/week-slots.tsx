"use client";

import type { Slot } from "../../../convex/lib/slots";
import { slotProgress, upNextSlot } from "../../../convex/lib/season";
import { repBars, slotStyle, slotTarget, toGoLabel, type SlotTone } from "./slot-style";
import { SlotIcon } from "./slot-icon";
import { groupCrossTraining } from "./cross-training";
import type { SeasonWeek, WeekRun } from "./types";

export const KIND_COLORS: Record<Slot["kind"], { solid: string; soft: string; ink: string; ring: string }> = {
  quality: { solid: "bg-slot-quality", soft: "bg-slot-quality-soft", ink: "text-slot-quality-ink", ring: "border-slot-quality" },
  long: { solid: "bg-slot-long", soft: "bg-slot-long-soft", ink: "text-slot-long-ink", ring: "border-slot-long" },
  easy: { solid: "bg-slot-easy", soft: "bg-slot-easy-soft", ink: "text-slot-done-ink", ring: "border-slot-easy" },
};

export function runLine(run: WeekRun): string {
  return [
    run.actualDistance ? `${run.actualDistance.toFixed(1)} km` : null,
    run.actualPace ? run.actualPace.replace("/km", "") + "/km" : null,
    run.avgHeartRate ? `HR ${Math.round(run.avgHeartRate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const TILE_BG: Record<SlotTone, (s: Slot) => string> = {
  done: () => "bg-slot-done-soft",
  next: (s) => KIND_COLORS[s.kind].soft,
  open: (s) => KIND_COLORS[s.kind].soft,
  bonus: () => "bg-white border-2 border-dashed border-winter-line",
  skipped: () => "bg-white border-2 border-dashed border-winter-line opacity-60",
};

const BADGE: Record<SlotTone, string> = {
  done: "bg-slot-done text-slot-done-ink",
  next: "bg-white text-slot-quality-ink",
  open: "bg-white text-winter-muted",
  bonus: "bg-[#eef0f8] text-winter-muted",
  skipped: "bg-[#eef0f8] text-winter-muted",
};

function RepBars({ count, light = false }: { count: number; light?: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className={`h-1 w-1.5 rounded-full ${light ? "bg-[#ffb3cc]" : "bg-[#f4a3bf]"}`} />}
          <span
            className={`h-2 flex-1 rounded-full ${
              light ? (i === count - 1 ? "bg-sun" : "bg-white") : "bg-slot-quality"
            }`}
          />
        </span>
      ))}
    </div>
  );
}
export { RepBars };

export function SlotTile({
  slot,
  fill,
  isUpNext,
  onOpen,
}: {
  slot: Slot;
  fill: WeekRun | null;
  isUpNext: boolean;
  onOpen: () => void;
}) {
  const style = slotStyle(slot, fill, isUpNext);
  const colors = KIND_COLORS[slot.kind];
  const bars = repBars(slot);
  const dashed = style.tone === "bonus" || style.tone === "skipped";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-[18px] text-left transition-transform active:scale-[0.99] ${
        dashed ? "p-3" : "p-3.5"
      } ${TILE_BG[style.tone](slot)}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${
          dashed ? colors.soft : colors.solid
        }`}
      >
        <SlotIcon
          name={style.icon}
          className={`h-6 w-6 ${dashed ? colors.ink : "text-white"}`}
          fill={style.icon === "bolt" && !dashed ? "currentColor" : "none"}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-base font-bold text-winter-ink ${style.tone === "skipped" ? "line-through" : ""}`}>
            {slot.title}
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE[style.tone]}`}>
            {style.badge}
          </span>
        </span>
        {fill ? (
          <>
            <span className="text-sm font-semibold text-slot-done-ink">{runLine(fill)}</span>
            {slot.targetDistance && fill.actualDistance && fill.actualDistance > slot.targetDistance * 1.2 ? (
              <span className="text-xs text-[#2d6b4c]">Plan said {slotTarget(slot)}. You went big.</span>
            ) : null}
          </>
        ) : (
          <>
            {bars > 0 && style.tone !== "skipped" && <RepBars count={bars} />}
            <span className={`text-[13px] ${dashed ? "text-winter-muted" : colors.ink}`}>{slotTarget(slot)}</span>
          </>
        )}
      </span>
    </button>
  );
}

function ProgressTokens({ week }: { week: SeasonWeek }) {
  const live = week.slots.filter((s) => !s.skipped);
  return (
    <div className="flex gap-2" aria-hidden="true">
      {live.map((s) => {
        const filled = !!week.fills[s.id];
        const colors = KIND_COLORS[s.kind];
        const style = slotStyle(s, null, false);
        return (
          <span
            key={s.id}
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              filled
                ? "bg-slot-done"
                : s.optional
                  ? "border-[3px] border-dashed border-[#9aa3c7]"
                  : `border-[3px] ${colors.ring}`
            }`}
          >
            <SlotIcon
              name={filled ? "check" : style.icon}
              className={`h-5 w-5 ${filled ? "text-slot-done-ink" : s.optional ? "text-[#9aa3c7]" : colors.ink}`}
              strokeWidth={filled ? 3 : 2.2}
            />
          </span>
        );
      })}
    </div>
  );
}

/** This week: progress tokens, one tile per slot, extra runs and cross-training. */
export function WeekSlots({ week, onOpenSlot }: { week: SeasonWeek; onOpenSlot: (slotId: string) => void }) {
  const progress = slotProgress(week.slots, week.fills);
  const next = upNextSlot(week.slots, week.fills);
  const chips = groupCrossTraining(week.crossTraining);

  return (
    <div className="flex flex-col gap-3">
      {week.plan ? (
        <>
          <div className="flex items-center gap-3.5 rounded-[18px] bg-white p-3.5">
            <ProgressTokens week={week} />
            <div className="flex flex-col">
              <span className="font-display text-xl font-extrabold text-winter-ink">{progress.done} down</span>
              <span className="text-[13px] text-winter-muted">
                {toGoLabel(progress.done, progress.required, progress.total)}
                {progress.done < progress.total ? ", any days" : ""}
              </span>
            </div>
          </div>
          {week.plan.note && <p className="text-[13px] text-winter-muted">{week.plan.note}</p>}
          {week.slots.map((s) => (
            <SlotTile
              key={s.id}
              slot={s}
              fill={week.fills[s.id] ?? null}
              isUpNext={next?.id === s.id}
              onOpen={() => onOpenSlot(s.id)}
            />
          ))}
        </>
      ) : (
        <p className="rounded-[18px] border-2 border-dashed border-winter-line bg-white p-4 text-sm text-winter-muted">
          Your coach hasn&apos;t set this week yet. Runs still count, and they&apos;ll show up here.
        </p>
      )}

      {week.extras.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-winter-muted">Extra runs</span>
          {week.extras.map((r) => (
            <div key={r._id} className="flex items-center justify-between rounded-[14px] bg-white px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-winter-ink">{r.dayOfWeek.slice(0, 3)}</span>
              <span className="text-winter-muted">{runLine(r)}</span>
            </div>
          ))}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-winter-muted">Also moved this week</span>
          <div className="flex flex-wrap gap-2">
            {chips.map(({ kind, Icon, tone, text }) => (
              <span key={kind} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${tone}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
