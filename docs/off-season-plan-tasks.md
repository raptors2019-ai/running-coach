# Off-season plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a season mode in which each Mon–Sun week holds 2–3 dayless run slots that Strava runs fill automatically. Show it on Plan and Today in the playful winter look, and make the coach plan with it.

**Architecture:** Two new Convex tables (`seasons`, `weekPlans`) sit beside the untouched dated `workouts`. A pure matcher derives slot fills at query time. Season mode turns on when today falls inside a season; otherwise the app behaves as it does now.

**Tech Stack:** Next.js 16 App Router, Convex, Tailwind v4 + shadcn, lucide, date-fns, Jest.

**Spec:** `docs/off-season-plan-spec.md` (mockup linked there).

## Global Constraints

- Logged runs never move or change. Slots reference runs and never rewrite them.
- Plan rebalancing from the UI goes to `/coach?draft=<text>`. The only direct write is pinning a run to a slot.
- Weeks are Monday–Sunday; dates are `YYYY-MM-DD`; "today" means Toronto.
- Colours: navy `#1b2550`, quality `#e83e78`, long `#4c8dff`, easy `#1f9d57`, done `#3ddc97`, sunrise `#ff7a45`, sun `#ffd23f`. Display font Bricolage Grotesque, body Geist.
- Touch targets ≥ 44 px; text contrast AA.
- No active season ⇒ current behaviour, byte-for-byte where practical.

## Review Focus

1. A week with no `weekPlans` row (the coach hasn't written it): the Plan and Today views say so and still list that week's runs as extras. No crash.
2. A pinned run that has disappeared (rematch, deletion): the slot falls back to auto-matching rather than showing empty.
3. More runs than slots → extras are counted; zero runs → every slot open and the ring at 0.
4. Warmup/cooldown segment rows on a quality day must not fill the easy slot.
5. Dates outside any season (before Oct 12, after Jun 13): `findActiveSeason` returns null and the old views render.

---

### Task 1: Slot model and matcher

**Files:**
- Create: `convex/lib/slots.ts`, `convex/lib/slotMatching.ts`
- Test: `convex/lib/slotMatching.test.ts`

**Interfaces:**
- Produces: `slotValidator` (Convex validator, shape from the spec), `type Slot`, `type SlotKind = "quality" | "long" | "easy"`.
- Produces: `type MatchableRun = { _id: string; date: string; type: string; title: string; completed: boolean; actualDistance?: number; actualDuration?: number; originalType?: string }`.
- Produces: `fillSlots(slots: Slot[], runs: MatchableRun[]): { fills: Record<string, MatchableRun | null>; extras: MatchableRun[] }`.
- Produces: `weekRuns(rows)`: filters to completed running rows with distance > 0, excluding titles starting `Warmup —` / `Cooldown —`.

- [ ] **Step 1: Write the failing tests**
  - `pinned run wins`: a pin to the 5 km run fills the long slot even though a 15 km run exists.
  - `pin to a missing run falls back`: `pinnedWorkoutId: "gone"` → the long slot gets the longest run.
  - `quality by type first`: an `intervals`-typed 8 km run fills quality ahead of a faster `run`.
  - `quality by pace`: runs 15 km @ 7:11, 8 km @ 6:22, 5 km @ 7:00 (all type `run`) → quality=8 km, long=15 km, easy=5 km.
  - `quality ignores runs under 3 km`.
  - `skipped slot takes nothing`.
  - `extras`: 4 runs and 3 slots → 1 extra.
  - `no runs`: every fill is null, extras empty.
  - `weekRuns drops segments and non-runs`.
- [ ] **Step 2: Run** `npx jest convex/lib/slotMatching` and expect FAIL (module missing).
- [ ] **Step 3: Implement** in the spec's order: pins → quality → long → easy → extras. Pace = `actualDuration / actualDistance`. Rows lacking duration sort last for pace.
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat: slot model and run-to-slot matcher`.

### Task 2: Season date helpers

**Files:**
- Create: `convex/lib/season.ts`
- Test: `convex/lib/season.test.ts`

**Interfaces:**
- Produces: `type SeasonLike = { startDate; endDate; phases: {key,name,startDate,endDate,focus}[]; checkpoints: {date,label,distanceKm,aimSeconds?,isGoal,resultSeconds?}[]; goals: {label,distanceKm,targetSeconds,byDate}[] }`.
- `findActiveSeason<T extends SeasonLike>(seasons: T[], today: string): T | null`
- `mondayOf(date: string): string`, `addDaysIso(date: string, n: number): string`
- `seasonWeekIndex(season, date): number` (1-based)
- `phaseFor(season, date): { phase, index, weekInPhase, weeksInPhase } | null`
- `seasonProgress(season, date): number` (0–1, clamped)
- `nextCheckpoint(season, today): { checkpoint, daysAway } | null` (first checkpoint on or after today)
- `slotProgress(slots: Slot[], fills): { done: number; required: number; total: number; label: string }`, where the label is "1 of 2–3", or "2 of 2" when required = total.
- `upNextSlot(slots, fills): Slot | null` (first unfilled, unskipped, non-optional slot, quality first)

- [ ] **Step 1: Write failing tests** using the winter season from the spec:
  - Oct 15 → week 1, Base week 1 of 9.
  - Dec 13 → Base. Dec 14 → 10K build week 1 of 17.
  - Jun 14 → `findActiveSeason` null. Oct 11 → null.
  - `nextCheckpoint("2026-10-15")` → Dec 12, 58 days.
  - `slotProgress` → "1 of 2–3".
  - `upNextSlot` picks quality.
- [ ] **Step 2: Run** `npx jest convex/lib/season`, expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat: season date and progress helpers`.

### Task 3: Schema, season queries, pinning, season-aware week stats

**Files:**
- Modify: `convex/schema.ts` (add `seasons`, `weekPlans` exactly as in the spec)
- Create: `convex/seasons.ts`
- Modify: `convex/coach.ts` (`computeWeekStats`)

**Interfaces:**
- Consumes: Task 1 and Task 2 exports.
- Produces (public queries):
  - `api.seasons.getActiveSeason` → `{ season, today, weekStart, weekIndex, phase, progress, nextCheckpoint } | null`
  - `api.seasons.getSeasonWeek({ weekStart })` → `{ plan: Doc<"weekPlans"> | null, slots: Slot[], fills: Record<slotId, WorkoutSummary|null>, extras: WorkoutSummary[], crossTraining: {type,title,actualDistance?}[], totals: { runKm, runs, crossCount } }`, where `WorkoutSummary = { _id, date, dayOfWeek, title, type, actualDistance, actualPace, avgHeartRate }`.
- Produces (public mutation): `api.seasons.pinRunToSlot({ weekStart, slotId, workoutId: v.union(v.id("workouts"), v.null()) })`.
- Produces (internal): `internal.seasons.createSeason(season fields)` → id. `internal.seasons.setWeekSlots({ weekStart, slots, status, note? })` → summary string; it keeps `pinnedWorkoutId` for surviving slot ids. `internal.seasons.getWeekPlanInternal({ weekStart })`.
- `computeWeekStats`: when a weekPlan exists, `runsPlanned` = required slots, `plannedKm` = their targetDistance sum, and `qualityTitle`/`qualityCompleted`/`qualityPace` come from the quality slot fill.

- [ ] **Step 1:** Add the tables; `npx convex codegen` (or `npx tsc --noEmit` after `convex dev --once` in Task 8). Type-check passes.
- [ ] **Step 2:** Implement the queries and mutations. `getSeasonWeek` reads workouts in `[weekStart, weekStart+6]`, uses `weekRuns` + `fillSlots`, and counts non-running, non-rest rows as cross-training.
- [ ] **Step 3:** Make `computeWeekStats` season-aware (a weekPlan lookup by `by_week_start`).
- [ ] **Step 4: Run** `npx tsc --noEmit && npm test`, expect PASS.
- [ ] **Step 5: Commit** `feat: seasons and week plans in Convex`.

### Task 4: Coach knows the season

**Files:**
- Modify: `convex/coachActions.ts` (prompt, context block, tools, runTool, briefing skip rule, weekly review)
- Modify: `convex/coach.ts` (`getCoachContext` and `getWeekReviewInput` gain `season` and `seasonWeeks`)

**Interfaces:**
- Consumes: Task 3 internals.
- Tools added: `get_week_plan {week_start}`, `set_week_slots {week_start, slots[], status, note?}` (each slot has the spec's fields with snake_case `target_distance`, `target_pace`), `pin_run {week_start, slot_id, date}` (resolves that date's completed run).
- Context lines: `SEASON: …`, `THIS WEEK'S SLOTS (fills app-computed): …`, `NEXT WEEK: …`, `Next checkpoint: <label> <date>, <n> days`. Drop "days to race" once the plan's raceDate has passed.

- [ ] **Step 1:** Rewrite the prompt's opening paragraph to the past tense (Oakville block, 23:38 chip on Oct 4, 4:57/4:51/4:53/4:44 + 4:14 close). Add a SEASON paragraph: the goals (10K sub-50 by Apr, 5K sub-20 by Jun), phases, checkpoints, and slot rules: no days, quality first, the long run grows ~1 km a week in Base, easy is optional, cross-training counts. In season mode, plan with `set_week_slots`, never `add_workout`. Rebalancing requested in chat is applied and summarised.
- [ ] **Step 2:** Add the tools and the dispatch.
- [ ] **Step 3:** Briefing: with an active season, the skip rule becomes "no run yesterday and today isn't Monday".
- [ ] **Step 4:** Weekly review: with an active season, pass `set_week_slots` alongside `write_weekly_review` (tool_choice auto, loop ≤ 4 turns). The instruction is to set the new week (status "set") and draft the next, then write the review. The lookahead must state what was set.
- [ ] **Step 5: Run** `npx tsc --noEmit && npm test`, expect PASS.
- [ ] **Step 6: Commit** `feat: coach plans the off-season in weekly slots`.

### Task 5: Season look and Plan components

**Files:**
- Modify: `src/app/globals.css` (`@theme` tokens: `--color-winter-navy`, `-navy-2 #33407a`, `-ice #dfe7ff`, `-snow #f4f6fd`, `--color-slot-quality`, `-long`, `-easy`, `-done`, `--color-sunrise`, `--color-sun`, `--font-display`)
- Modify: `src/app/layout.tsx` (Bricolage Grotesque via `next/font/google`, variable `--font-bricolage`)
- Create: `src/components/season/season-hero.tsx`, `week-slots.tsx`, `next-week.tsx`, `checkpoint-trail.tsx`, `season-badge.tsx`, `slot-style.ts`
- Test: `src/components/season/slot-style.test.ts`

**Interfaces:**
- Consumes: `api.seasons.getActiveSeason`, `api.seasons.getSeasonWeek`, Task 2 helpers.
- `slotStyle(slot: Slot, fill, isUpNext): { tone: "done"|"next"|"open"|"bonus"|"skipped"; icon: "mountain"|"bolt"|"leaf"|"check"; badge: string }`, where badge is `DONE · MON`, `UP NEXT`, `BONUS` or `SKIPPED`.
- `SeasonHero({ season, progress })`, `WeekSlots({ week, onOpenSlot(slotId) })`, `NextWeek({ week })`, `CheckpointTrail({ season, today })`, `SeasonBadge()`.

- [ ] **Step 1: Write the failing test** for `slotStyle`: a filled long slot → done with a `DONE · MON` badge; an open quality slot that is up next → next/bolt/`UP NEXT`; an optional open easy slot → bonus/leaf/`BONUS`.
- [ ] **Step 2: Run**, expect FAIL. **Step 3:** Implement `slotStyle`. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Build the components to the mockup:
  - The hero SVG trail places the "you" marker at `progress` along the path (use `getPointAtLength` through a ref, or an interpolated polyline).
  - Interval slots draw one bar per rep from `intervals[0].reps`.
  - Cross-training chips use lucide `Bike`, `Volleyball`/`Dribbble`, `Dumbbell`.
  - A missing weekPlan renders "Your coach hasn't set this week yet", plus the extras.
- [ ] **Step 6:** Run `npx tsc --noEmit`, expect PASS. **Commit** `feat: season look and plan components`.

### Task 6: Slot sheet

**Files:**
- Create: `src/components/season/slot-sheet.tsx`
- Create: `src/components/season/coach-drafts.ts`
- Test: `src/components/season/coach-drafts.test.ts`

**Interfaces:**
- `coachDraft(kind: "skip"|"push"|"swap", slot: Slot, weekStart: string): string`. Example: skip → `Skip "Track: 5×800m" this week (week of Oct 12) — rebalance the rest if it needs it.`
- `coachHref(text: string): string` → `/coach?draft=${encodeURIComponent(text)}`
- `SlotSheet({ open, onOpenChange, slot, fill, weekStart, weekRuns })` (shadcn `Dialog`).

- [ ] **Step 1: Write failing tests** for `coachDraft` (all three kinds include the title and the week label) and for `coachHref` encoding.
- [ ] **Step 2: Run**, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Build the sheet:
  - A colour header with the kind label and title.
  - The track graphic and rep chips (from `intervals`).
  - The description.
  - A "Which run was it?" select over that week's runs, plus "Auto", calling `pinRunToSlot`.
  - A yellow coach card: a textarea prefilled with `coachDraft("skip")`, buttons "Push to next week" and "Skip this week" that swap the textarea text, and "Send to coach" linking to `coachHref(text)`.
- [ ] **Step 6:** `npx tsc --noEmit`. **Commit** `feat: slot sheet with run pinning and coach hand-off`.

### Task 7: Wire Plan and Today

**Files:**
- Modify: `src/app/plan/page.tsx`, `src/app/page.tsx`
- Create: `src/components/season/season-today-card.tsx`, `next-checkpoint-card.tsx`, `season-plan-view.tsx`

**Interfaces:**
- Consumes: Tasks 3, 5 and 6.
- `SeasonPlanView()`: hero → this week → next week → checkpoints → trophy shelf (the "Oakville 5K · 23:38" card toggles the existing `<WorkoutCalendar />`).
- `SeasonTodayCard()` and `NextCheckpointCard()` as in the mockup's Today screen.

- [ ] **Step 1:** `/plan`: when `getActiveSeason` returns a season, render `SeasonPlanView` and `SeasonBadge` (the heading becomes "Plan"). Otherwise render the current page. Keep the gameplan and breathwork links under the season view.
- [ ] **Step 2:** `/`: in season mode, the header shows `SeasonBadge`. Render JournalNudgeBanner, `SeasonTodayCard`, `NextCheckpointCard`, BreathworkCard and WeatherWidget, and hide the race-only pieces listed in the spec. While `getActiveSeason` is loading (undefined), render nothing in that slot, so the old page never flashes.
- [ ] **Step 3:** `npx tsc --noEmit && npm test && npm run build`, expect PASS.
- [ ] **Step 4:** Browser check at 390 px with live data via `next-dev`: Plan shows Monday's 15.1 km filling the long slot, Today shows "1 of 2–3", the slot sheet opens, and "Send to coach" lands on /coach with the draft filled.
- [ ] **Step 5: Commit** `feat: season mode on Plan and Today`.

### Task 8: Ship and seed

- [ ] **Step 1:** `npx convex dev --once` pushes the schema and functions to `precious-whale-612`.
- [ ] **Step 2:** `npx convex run seasons:createSeason '<winter JSON from the spec>'`.
- [ ] **Step 3:** `seasons:setWeekSlots` for weekStart `2026-10-12` ("set": long 10–12 km @ 6:45–7:15; quality Track 5×800m with intervals `[{distance:"800m",pace:"3:45-3:50",rest:"2:00 jog",reps:5}]` and today's description; easy 4–6 km optional) and `2026-10-19` ("draft": tempo 3×2 km @ 4:55 with 2:00 jog; long 12 km; easy 5 km optional).
- [ ] **Step 4:** Delete the uncompleted Oct 16 dated row `j97cgq81d9x6p8vrepvpmnr0qd8gdvvd` (it is now the quality slot). Verify with `seasons:getSeasonWeek '{"weekStart":"2026-10-12"}'` that long is filled by the Oct 12 15.07 km run.
- [ ] **Step 5:** Open a PR, merge to main, wait for the Vercel production deploy, load https://runningcoach-liard.vercel.app/plan and `/`, and report what rendered.
