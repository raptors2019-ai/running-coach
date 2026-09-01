# Spec: Fresh Strava sync, missed-run handling, and checkpoint results

**Date:** 2026-09-01 · **Status:** Phases 1–2 implemented on this branch (throttle drop,
`missedAt` detection + briefing adaptation with tools, `checkpoints` table +
`record_checkpoint` + UI card). Phase 3 (Strava webhook) still proposed.

## Why this exists

Three things went wrong (or felt wrong) in the first week of the Oakville block:

1. **Today's run didn't show up promptly.** The Sep 1 8x400m session was on Strava but the
   app didn't reflect it right away.
2. **Sunday's missed run just… sat there.** The Aug 30 Zone 2 5km was skipped. Nothing marked
   it missed, nothing adapted the plan — the row stays "planned" forever.
3. **The benchmark was passed but the app has no memory of it.** The Aug 27 2K TT
   (1.98 km in 9:12, 4:39/km — under the 9:50 bar → "chase 24:30") is the plan's biggest
   decision point, yet there is nowhere in the data model that records the outcome. The
   athlete was left asking "do I still need to retest tomorrow?" — a question the app should
   answer itself.

## How it works today (as built)

- **Sync is pull-only, on two triggers:** opening the app (`useAutoStravaSync`, throttled to
  once per hour via `stravaAuth.lastSyncAt`) and the 6:00 AM morning-briefing cron
  (`generateBriefing` calls `syncAndAutoMatch` best-effort). There is no Strava-side push and
  no standalone sync cron. So a run finished at 6 PM is invisible until the next app-open
  that's >1h after the last sync — and if you open the app *right after* a sync already
  happened that hour, the new run is skipped until the throttle expires.
- **Matching is good** (type affinity + pace tiebreak, segment labeling for separately-logged
  warmup/cooldown) — the freshness problem is upstream of it.
- **`workouts.completed` is a boolean.** There is no `missed` state, no detection pass, and no
  adaptation. The weekly review counts `runsPlanned` vs `runsCompleted` after the fact; the
  coach briefing may mention a gap in prose; the plan itself never changes.
- **Checkpoint logic lives only in prose** — in `TRAINING_PLAN.md`, the seeded workout
  description, and the coach system prompt. The decision rule is known; the *result* is never
  stored. `trainingPlan.goalTime` is a static 1500s.

## Gap A — Sync freshness

### Options

| | Approach | Pros | Cons |
|---|---|---|---|
| A1 | **Strava webhooks** (Events API → Convex `httpAction`) | Near-real-time (fires on upload); negligible API quota; Convex HTTP actions are a natural fit; single-athlete app makes subscription management trivial | One-time setup (subscription create + GET validation echo); webhook only delivers activity IDs, so the handler still calls the existing sync; needs a reconciliation path for missed events |
| A2 | Standalone sync cron (every 30–60 min) | ~5 lines in `crons.ts` | Still up to an hour stale; polls all day for one athlete; doesn't fix the "finished run, opened app, nothing there" moment |
| A3 | Lower the on-open throttle (60 min → 10–15 min) | One-constant change; directly fixes the common case (you open the app right after a run) | Only helps when the app is opened |

### Recommendation: A1 + A3

Ship **A3 now** (change `ONE_HOUR_MS` to ~15 min — Strava's limits are 200 req/15 min; a
single athlete opening an app is nowhere near that). Build **A1** as the real fix: an
`httpAction` at `/strava/webhook` that answers the `hub.challenge` validation GET and, on
activity-create/update POSTs, schedules `syncAndAutoMatch` (reusing all existing matching).
Keep the existing on-open and 6 AM pulls as reconciliation for dropped webhook events. Skip A2
entirely — it's the worst of both.

## Gap B — Missed runs: detection + plan adaptation

### B1. Detection (deterministic, in code)

A planned workout is **missed** when: it is a running type, its date is in the past
(America/Toronto), it is not completed, and one post-day sync has already run (the 6 AM
briefing sync provides exactly this grace window for late-evening uploads).

- Schema: add `missedAt: v.optional(v.number())` to `workouts` — additive, no migration,
  and the boolean `completed` semantics stay untouched. (A full
  `status: planned|completed|missed|skipped` union is cleaner but forces a migration and
  touches every read site; not worth it for a 6-week single-user plan.)
- Set it in a small internal mutation called from the morning cron **after** the sync step.
- Auto-clear it if a later sync matches an activity to the row (`rematch_date` and late
  uploads keep working).
- UI: grey the row with a "Missed" badge instead of leaving it looking pending forever.

### B2. Adaptation — options

| | Approach | Pros | Cons |
|---|---|---|---|
| B2a | Deterministic rules in code (missed easy → absorb; missed long → shift within week; missed quality → reschedule protecting hard-day spacing) | Predictable, testable | A second rule engine that duplicates the coaching policy already written in the system prompt; rules get gnarly fast (what if the shift target has a lift? two misses?) |
| B2b | **Coach-agent adaptation:** give `generateBriefing` the same `TOOLS` the chat coach already has; the morning briefing notices the fresh `missedAt`, applies the existing guardrails (protect Tuesday quality + checkpoints, easy volume is cut first, never stack hard days, never edit completed), and *states in the briefing exactly what it changed* | Zero new machinery — tools, guardrails, and mutations all exist and are battle-tested from chat; every edit is visible and reversible in chat ("move it back") | LLM judgment on edits; briefing cost/latency up slightly |
| B2c | Manual only (chat: "I missed Sunday, fix my week") | Zero risk | This is the status quo the athlete is asking to get rid of |

### Recommendation: B1 + B2b

Detection must be code (trust), adaptation should be the coach (judgment). The one hard rule
worth *enforcing in code* rather than prompt: the two checkpoint workouts and the race can be
moved but never deleted or overwritten while uncompleted. Everything else the existing
system-prompt rules already cover, and the briefing doubles as the audit log. In practice most
missed easy runs should be absorbed, not rescheduled — which is exactly what the current
coaching rules say.

## Gap C — Checkpoint results as first-class data

### Options

- **C1: `checkpoints` table** — `{ key: "benchmark_2k" | "race_pace_3k", date, workoutId?,
  resultSeconds, resultDistanceKm, decision, goalSeconds, recordedAt }`. Written by a new
  `record_checkpoint` coach tool (the briefing evaluates the decision rule when a checkpoint
  workout completes; chat can correct it). Read by `getCoachContext`, a small UI card
  ("Benchmark: 9:12 → chasing 24:30 ✓"), and the race-strategy view (switch to the 24:30
  split table once upgraded).
- **C2: encode the outcome in `workout.notes`** — what the interim backfill does. Zero
  schema work, survives resees (completed rows are preserved), coach sees it in context. But
  it's unstructured: nothing can *branch* on it, and the goal never actually updates.
- **C3: fields on `trainingPlan`** (`stretchUnlocked`, `goalTimeStretch`) — minimal, but
  loses the per-checkpoint history and doesn't generalize to the Sep 15 test's 3 outcomes.

### Recommendation: C1, with C2 as the already-shipped stopgap

The plan's whole design is "decided by the checkpoints" — that decision deserves a row, not a
sentence. C1 is ~1 table + 1 tool + 1 context line, and it makes "do I need to retest?"
answerable by the app: benchmark row exists with `decision: "chase 24:30"` → no.

## The one ideal outcome (what I'd ship, in order)

1. **Now (shipped alongside this spec):** `backfill:recordBenchmarkResult` writes the Aug 27
   result + decision into the workout history (idempotent, works whether or not the Strava
   sync matched it), and `TRAINING_PLAN.md` records the pass. Run it with
   `npx convex run backfill:recordBenchmarkResult`.
2. **Phase 1 (minutes):** on-open throttle 60 → 15 min (A3).
3. **Phase 2 (the substance):** `missedAt` detection in the morning cron + briefing gets the
   coach tools and adapts the week under the existing guardrails (B1 + B2b), plus the
   `checkpoints` table and `record_checkpoint` tool (C1).
4. **Phase 3:** Strava webhook endpoint with pull-sync as reconciliation (A1).

This ordering front-loads the things that change coaching decisions (missed-run adaptation,
checkpoint memory) and treats real-time sync as the polish it is — the 6 AM briefing sync
already guarantees the coach never *reasons* on stale data; webhooks just make the app feel
alive between briefings.
