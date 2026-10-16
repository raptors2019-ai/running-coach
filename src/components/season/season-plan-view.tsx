"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { addDaysIso } from "../../../convex/lib/season";
import { WorkoutCalendar } from "@/components/workout-calendar";
import { SeasonHero } from "./season-hero";
import { WeekSlots } from "./week-slots";
import { NextWeek } from "./next-week";
import { CheckpointTrail } from "./checkpoint-trail";
import { useSlotSheet } from "./use-slot-sheet";
import type { ActiveSeason } from "./types";

const range = (weekStart: string) =>
  `${format(parseISO(weekStart), "MMM d")} – ${format(parseISO(addDaysIso(weekStart, 6)), "MMM d")}`;

function SectionHeading({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="font-display text-[19px] font-extrabold text-winter-ink">{title}</h3>
      {aside && <span className="text-xs text-winter-muted">{aside}</span>}
    </div>
  );
}

/** Plan page in season mode: the trail, this week's slots, next week's draft, checkpoints, past blocks. */
export function SeasonPlanView({ active }: { active: ActiveSeason }) {
  const nextWeekStart = addDaysIso(active.weekStart, 7);
  const week = useQuery(api.seasons.getSeasonWeek, { weekStart: active.weekStart });
  const nextWeek = useQuery(api.seasons.getSeasonWeek, { weekStart: nextWeekStart });
  const plan = useQuery(api.workouts.getTrainingPlan);
  const [showBlock, setShowBlock] = useState(false);
  const { open, sheet } = useSlotSheet(week);

  return (
    <div className="flex flex-col gap-[18px]">
      <SeasonHero active={active} />

      <section className="flex flex-col gap-3">
        <SectionHeading title="This week" aside={range(active.weekStart)} />
        {week ? <WeekSlots week={week} onOpenSlot={open} /> : <div className="h-40 animate-pulse rounded-[18px] bg-white" />}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading
          title="Next week"
          aside={`${range(nextWeekStart)}${nextWeek?.plan?.status === "draft" ? " · draft" : ""}`}
        />
        {nextWeek && <NextWeek week={nextWeek} />}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading title="Checkpoints" />
        <CheckpointTrail active={active} />
      </section>

      {plan && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading title="Trophy shelf" />
          <button
            type="button"
            onClick={() => setShowBlock((s) => !s)}
            aria-expanded={showBlock}
            className="flex min-h-11 items-center gap-3 rounded-[18px] bg-sun-soft px-3.5 py-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sun">
              <Trophy className="h-[22px] w-[22px] text-sun-ink" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-bold text-[#3d2a00]">{plan.name}</span>
              <span className="text-xs text-sun-ink">
                {format(parseISO(plan.startDate), "MMM d")} – {format(parseISO(plan.raceDate), "MMM d")} block
              </span>
            </span>
            {showBlock ? (
              <ChevronDown className="h-5 w-5 text-sun-ink" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5 text-sun-ink" aria-hidden="true" />
            )}
          </button>
          {showBlock && (
            <div className="rounded-[18px] bg-white p-3">
              <WorkoutCalendar />
            </div>
          )}
        </section>
      )}
      {sheet}
    </div>
  );
}
