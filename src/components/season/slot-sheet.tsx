"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { Sparkles, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Slot } from "../../../convex/lib/slots";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { coachDraft, coachHref, type DraftKind } from "./coach-drafts";
import { repBars, slotStyle, slotTarget } from "./slot-style";
import { SlotIcon } from "./slot-icon";
import { runLine } from "./week-slots";
import type { WeekRun } from "./types";

const HEADER: Record<Slot["kind"], { bg: string; deep: string; label: string }> = {
  quality: { bg: "bg-slot-quality", deep: "bg-slot-quality-deep", label: "QUALITY SLOT" },
  long: { bg: "bg-slot-long", deep: "bg-[#2f6ae0]", label: "LONG RUN SLOT" },
  easy: { bg: "bg-slot-easy", deep: "bg-[#167a43]", label: "EASY SLOT" },
};

function TrackGraphic({ reps, distance }: { reps: number; distance: string }) {
  const laps = /^(\d+)m$/.exec(distance);
  const lapsPerRep = laps ? Number(laps[1]) / 400 : null;
  return (
    <svg viewBox="0 0 358 92" className="block h-auto w-full" role="img" aria-label={`${reps} × ${distance} on the track`}>
      <rect x="4" y="6" width="350" height="80" rx="40" className="fill-slot-quality-deep" />
      <rect x="18" y="20" width="322" height="52" rx="26" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" opacity="0.5" />
      <rect x="40" y="34" width="278" height="24" rx="12" fill="#2fb36d" />
      <circle cx="44" cy="20" r="6" fill="#ffd23f" stroke="#fff" strokeWidth="2" />
      <text x="179" y="51" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0b3d27" className="font-display">
        {lapsPerRep && Number.isInteger(lapsPerRep)
          ? `${lapsPerRep} lap${lapsPerRep === 1 ? "" : "s"} = 1 rep`
          : `${reps} × ${distance}`}
      </text>
    </svg>
  );
}

/**
 * One slot, opened: the session, which run filled it (with a picker to
 * correct the guess), and plan changes handed to the coach as an editable
 * draft rather than applied silently.
 */
export function SlotSheet({
  open,
  onOpenChange,
  slot,
  fill,
  weekStart,
  runs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: Slot;
  fill: WeekRun | null;
  weekStart: string;
  runs: WeekRun[];
}) {
  const [draft, setDraft] = useState(() => coachDraft("skip", slot, weekStart));
  const [pinError, setPinError] = useState<string | null>(null);
  const pinRun = useMutation(api.seasons.pinRunToSlot);
  const header = HEADER[slot.kind];
  const style = slotStyle(slot, fill, false);
  const set = slot.intervals?.[0];
  const reps = repBars(slot);

  const pin = async (value: string) => {
    setPinError(null);
    try {
      await pinRun({ weekStart, slotId: slot.id, workoutId: value ? (value as Id<"workouts">) : null });
    } catch (e) {
      console.error("Pin failed", e);
      setPinError("Couldn't save that — try again.");
    }
  };
  const applyDraft = (kind: DraftKind) => setDraft(coachDraft(kind, slot, weekStart));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 max-w-md translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-0 p-0 sm:max-w-md"
      >
        <div className={`flex flex-col gap-2.5 px-4 pt-2.5 pb-4 text-white ${header.bg}`}>
          <span className="mx-auto h-1 w-9 rounded-full bg-white/50" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide">
                <SlotIcon name={style.icon} className="h-3.5 w-3.5 text-sun" fill={style.icon === "bolt" ? "currentColor" : "none"} />
                {header.label} · ANY DAY THIS WEEK
              </p>
              <DialogTitle className="font-display text-[26px] leading-tight font-extrabold">{slot.title}</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${header.deep}`}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          {slot.kind === "quality" && set && reps > 0 && <TrackGraphic reps={reps} distance={set.distance} />}
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto p-4 pb-7">
          {set && reps > 0 && (
            <div className="flex gap-1.5">
              {Array.from({ length: reps }, (_, i) => (
                <div
                  key={i}
                  className={`flex flex-1 flex-col items-center rounded-xl px-1 py-2 ${
                    i === reps - 1 ? "bg-sun text-[#3d2a00]" : "bg-slot-quality-soft text-slot-quality-ink"
                  }`}
                >
                  <span className="text-[11px]">Rep {i + 1}</span>
                  <span className="text-[13px] font-extrabold">{set.distance}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-semibold text-winter-ink">{slotTarget(slot)}</p>
          <DialogDescription className="text-[13px] leading-relaxed whitespace-pre-line text-[#3b4263]">
            {slot.description}
          </DialogDescription>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`pin-${slot.id}`} className="text-xs font-semibold text-winter-muted">
              Which run was it?
            </label>
            <select
              id={`pin-${slot.id}`}
              className="min-h-11 rounded-xl border-2 border-winter-line bg-white px-3 text-sm text-winter-ink"
              value={slot.pinnedWorkoutId ?? ""}
              onChange={(e) => pin(e.target.value)}
            >
              <option value="">{fill ? `Auto: ${fill.dayOfWeek.slice(0, 3)} · ${runLine(fill)}` : "Auto: the app matches it"}</option>
              {runs.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.dayOfWeek.slice(0, 3)} · {runLine(r)}
                </option>
              ))}
            </select>
            {pinError && <p className="text-xs text-red-700">{pinError}</p>}
          </div>

          <div className="flex flex-col gap-2 rounded-[18px] bg-sun-soft p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-winter-navy">
                <Sparkles className="h-3.5 w-3.5 text-sun" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-[#3d2a00]">Change the plan with your coach</span>
            </div>
            <label htmlFor={`draft-${slot.id}`} className="text-xs font-semibold text-sun-ink">
              Edit the message first
            </label>
            <textarea
              id={`draft-${slot.id}`}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="resize-none rounded-xl border-2 border-sun bg-white p-2.5 text-[13px] leading-snug text-winter-ink"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyDraft("push")}
                className="min-h-11 flex-1 rounded-xl bg-white text-[13px] font-semibold text-[#3b4263]"
              >
                Push to next week
              </button>
              <button
                type="button"
                onClick={() => applyDraft("skip")}
                className="min-h-11 flex-1 rounded-xl bg-white text-[13px] font-semibold text-[#3b4263]"
              >
                Skip this week
              </button>
            </div>
            <Link
              href={coachHref(draft)}
              className="flex min-h-11 items-center justify-center rounded-xl bg-winter-navy text-sm font-bold text-white"
            >
              Send to coach
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
