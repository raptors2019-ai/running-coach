# Off-season plan — flexible weekly slots

Status: approved design, 2026-10-15. Mockup: Claude Design canvas "Off-Season Plan View"
(https://claude.ai/artifact/YcG2cQ5RrJtjqLAn6TzoSC): Plan, Today, slot sheet.

## Why

The Oakville 5K block ended on Oct 4 (23:38 chip). The app is built around a dated race plan:
every run sits on a specific day, and the countdown, calendar, briefings and weekly stats all
assume that. Through winter, Josh runs 2–3 times a week on whichever days life allows, so
day-pinned plans keep going stale.

Goals, set by Josh:
- 10K under 50:00 by about April
- 5K under 20:00 by about June (PB 23:38)
- No race booked; "hold fitness" in tone, but the plan quietly builds toward both.

Planning horizon (chosen): a phase map to June plus checkpoint time trials. The coach writes
detailed slots only for this week and next, and adjusts each Monday from what was actually run.

## What it looks like

A **season** ("Winter 2026–27", Oct 12 → Jun 13) with three phases:

| Phase | Dates | Focus |
|---|---|---|
| Base | Oct 12 – Dec 13 | 2–3 runs: one quality, one long run growing ~1 km a week, easy optional |
| 10K build | Dec 14 – Apr 11 | Tempo and threshold work, long run toward 14–16 km |
| 5K speed | Apr 12 – Jun 13 | VO2max intervals, race-pace reps |

Checkpoints are time trials on target weekends, not hard dates: Dec 12 5K (aim ~23:00),
Feb 13 10K (~52:00), Apr 11 10K goal (sub-50), May 16 5K (~21:00), Jun 13 5K goal (sub-20).

Each **week** (Mon–Sun) has 2–3 **slots**. A slot is a kind (quality / long / easy), a session
(title, description, target distance, pace, optional rep table) and an `optional` flag. It
has no day. A run fills a slot whenever it happens that week.

## Design rules that carry over

- History stays anchored to dates. Strava runs stay dated `workouts` rows exactly as today;
  slots never move or rewrite a logged run.
- Strava is the source of truth for a run's numbers.
- Rebalancing goes through the coach chat as an editable message (`/coach?draft=`), never a
  silent rebuild. The slot sheet hands off "skip / push / swap" requests as drafts.
- The Oakville block (trainingPlan, its workouts, checkpoints) is kept untouched as history.

## Data model (approach A: slots beside dated runs)

New tables in `convex/schema.ts`:

```ts
seasons: defineTable({
  name: v.string(),                 // "Winter 2026–27"
  startDate: v.string(),            // a Monday
  endDate: v.string(),              // a Sunday
  goals: v.array(v.object({
    label: v.string(),              // "10K"
    distanceKm: v.number(),
    targetSeconds: v.number(),
    byDate: v.string(),
  })),
  phases: v.array(v.object({
    key: v.string(),                // "base" | "10k_build" | "5k_speed"
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    focus: v.string(),              // one line shown under the trail map
  })),
  checkpoints: v.array(v.object({
    date: v.string(),
    label: v.string(),              // "5K time trial"
    distanceKm: v.number(),
    aimSeconds: v.optional(v.number()),
    isGoal: v.boolean(),
    resultSeconds: v.optional(v.number()),
  })),
}).index("by_start", ["startDate"]),

weekPlans: defineTable({
  seasonId: v.id("seasons"),
  weekStart: v.string(),            // Monday
  status: v.union(v.literal("draft"), v.literal("set")),
  slots: v.array(slotValidator),
  note: v.optional(v.string()),     // the coach's one-liner for the week
}).index("by_week_start", ["weekStart"]),
```

`slotValidator` (in `convex/lib/slots.ts`):

```ts
{
  id: string,                       // stable within the week, e.g. "q1"
  kind: "quality" | "long" | "easy",
  type: string,                     // workout type for colours: intervals, tempo, long, easy…
  title: string,
  description: string,
  targetDistance?: number,
  targetPace?: string,
  intervals?: Interval[],           // same shape as workouts.intervals
  optional: boolean,
  pinnedWorkoutId?: Id<"workouts">, // a run assigned by hand (or by the coach)
  skipped?: boolean,                // dropped this week via the coach
}
```

The active season is the one whose `startDate <= today <= endDate` (Toronto date). No active
season means the app behaves exactly as it does today.

## Filling slots (derived, never stored)

`fillSlots(slots, runs)` in `convex/lib/slotMatching.ts` is a pure function, run at query
time. `runs` are the week's completed running rows with a distance, excluding warmup and
cooldown segment rows. Being derived, a Strava re-sync or rematch can never leave a stale fill.

Order:
1. Pinned: a slot whose `pinnedWorkoutId` is in `runs` takes that run.
2. Quality slots: a run whose type is quality (intervals, tempo, race_pace, race), else the
   fastest-average-pace remaining run of at least 3 km. Interval sessions average slower
   than their reps but still faster than easy runs (Sep 10: 6:22 vs 7:00).
3. Long slots: the longest remaining run.
4. Easy slots: any remaining run, longest first.
5. Runs left over are "extra runs", shown and counted, but filling nothing.

Skipped slots take nothing. Manual pins fix any wrong guess; the coach can pin too.

Week progress = filled slots / non-optional slots, shown as "1 of 2–3": 2 = required slots,
3 = all slots.

## Backend (`convex/seasons.ts`)

Queries:
- `getActiveSeason()`: the season plus derived `weekIndex`, `weeksInPhase`, current phase,
  next checkpoint and days to it.
- `getSeasonWeek({ weekStart })`: the week plan, fills, extra runs, cross-training rows
  (bikes, hoops, lifts, swims) and totals (run km, runs, cross-training count).

Mutations:
- `pinRunToSlot({ weekStart, slotId, workoutId | null })`: Josh's own correction, applied
  immediately (it changes which run fills a slot, never a run's numbers).
- `createSeason` (internal, run from the CLI) to seed the winter season.
- `setWeekSlots` (internal) for the coach: upsert a week's slots and status. It keeps the
  `pinnedWorkoutId` of slots whose id survives.

Week stats: `computeWeekStats` becomes season-aware. When a weekPlan exists for the week,
`runsPlanned` and `plannedKm` come from its required slots, and `qualityTitle` and
`qualityCompleted` come from the quality slot's fill. The weekly review and the coach then quote
real numbers instead of "0 planned".

## Coach

- The system prompt's opening paragraph moves to the past tense (the Oakville block and its
  result) and gains a SEASON section: goals, phases, checkpoints, and the slot model, i.e. no
  days, 2–3 runs, quality first, easy optional, cross-training counts.
- The context block gains: the active season, this week's slots with fills, next week's draft,
  and days to the next checkpoint. The "days to race" line only appears while a race plan is
  active.
- New tools: `get_week_plan(week_start)`, `set_week_slots(week_start, slots, status, note)`,
  `pin_run(week_start, slot_id, date)`. With a season active, the prompt tells the coach to
  plan with slots and not add dated workouts.
- Weekly review (Monday cron): with a season active it also gets `set_week_slots`, sets the new
  week (status "set") and drafts the one after, from what was actually run. The lookahead
  states what it set, and it's visible on the Coach weekly tab. Further changes go through chat.
- Morning briefing: in season mode it runs when yesterday had a run, or on Mondays.

## UI

Visual language (from the mockup): navy `#1b2550` hero, Bricolage Grotesque display headings
(next/font), Geist body, bright solid slot colours with tinted backgrounds. Slot colours:
quality pink `#e83e78`, long blue `#4c8dff`, easy green `#1f9d57`, done mint `#3ddc97`; accents
sunrise `#ff7a45` and sun `#ffd23f`. Tokens go in `globals.css` under `@theme`. Touch targets
44 px; text contrast AA.

Components in `src/components/season/`:
- `season-hero.tsx`: trail-map SVG (mountains, dotted trail, "you" marker positioned by season
  progress, 10K and 5K summit flags) and two goal tiles.
- `week-slots.tsx`: progress tokens ("1 down / 1–2 to go"), slot tiles (done / up next / bonus
  states, rep bars for interval slots), extra runs, cross-training chips.
- `next-week.tsx`: three compact draft tiles.
- `checkpoint-trail.tsx`: badges along the season.
- `slot-sheet.tsx`: dialog with the rep visualisation, description, "which run was it?" picker
  (pin), and an editable coach draft ("Skip this week", "Push to next week", or free text) that
  opens `/coach?draft=…`.
- `season-today-card.tsx`: ring plus up-next tile plus done/bonus tiles for the Today page.
- `next-checkpoint-card.tsx`: days-to-checkpoint ticket.
- `season-badge.tsx`: "Base · Wk 1 of 9" pill, replacing CountdownBadge in season mode.

Pages:
- `/plan`: season mode shows hero → this week → next week → checkpoints → trophy shelf (the
  Oakville block collapses into a card that expands to the existing WorkoutCalendar). The
  gameplan and breathwork links stay below.
- `/` (Today): season mode replaces the countdown, StalePlanBanner, WeekPreview, UpcomingDays,
  the old CheckpointCard, the weather optimiser and the week stats grid with the season badge,
  SeasonTodayCard and NextCheckpointCard. The journal nudge, breathwork and weather widget stay.

Pure helpers in `src/lib/season.ts` (unit-tested): week index, phase for a date, trail
progress, slot progress label, which slot is "up next".

## Seeding (live data)

1. `createSeason` with the table above.
2. Week of Oct 12 ("set"): long 10–12 km @ 6:45–7:15 (Monday's 15.1 km fills it); quality
   "Track: 5×800m" (moved from the dated Oct 16 row added today, which is then deleted since it
   is uncompleted plan, not history); easy 4–6 km, optional.
3. Week of Oct 19 ("draft"): tempo 3×2 km @ 4:55 with 2:00 jog; long 12 km @ 6:45–7:15; easy
   5 km, optional.

## Testing

- `convex/lib/slotMatching.test.ts`: pins win; quality by type, then by pace; long takes the
  longest; easy takes the rest; extras; skipped slots; segment rows ignored.
- `src/lib/season.test.ts`: week index, phase lookup at boundaries, progress labels, up-next.
- Season-aware week stats covered through the matcher tests and a stats helper test.
- `npm test`, `npx tsc --noEmit`, `npm run build`, and the browser preview of `/` and `/plan`.

## Out of scope (follow-ups)

- Progress page charts (WeeklyVolumeChart is hardcoded to weeks 1–6) and race prediction.
- Recording season checkpoint results (a `record_season_checkpoint` tool) before Dec 12.
- Editing slots by hand in the UI; changes go through the coach.
