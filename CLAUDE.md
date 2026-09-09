# Running Coach — project notes for Claude

## Standing permissions (granted by Josh, 2026-09-09)
- Commit, open PRs, merge to `main`, and deploy on your own without asking. Verify the
  deployment afterwards and report what you saw.
- Route plan *rebalancing* through the coach chat as an editable message, never a silent
  auto-rebuild. Josh wants to tweak what the coach changes.

## Deployment
- Vercel project `running_coach` (team joshs-projects). Git integration deploys `main` to
  production at https://runningcoach-liard.vercel.app. Build is plain `next build`; it does
  **not** run `convex deploy`.
- The production site talks to Convex deployment `precious-whale-612` — the same one
  `.env.local` calls `dev`. Backend changes ship with `npx convex dev --once` (or by
  running `npx convex dev`), so push Convex functions before or with the merge.
- That deployment holds the real data (Strava auth, plan, briefings). `npx convex run`
  reads/writes live data — read freely, write only when the change is intended.

## Verify before merging
- `npm test`, `npx tsc --noEmit`, `npm run build`
- Check the app in the browser preview (`.claude/launch.json` → `next-dev`).

## Design rules that aren't obvious from the code
- History is anchored to dates. Moving or swapping workouts exchanges the *plan*
  (type, title, description, targets, intervals); a date keeps its completion, Strava
  numbers and notes. Never move logged runs between dates.
- Strava is the source of truth for a run's numbers. A quick-completed placeholder row
  (target distance, no pace) gets replaced by the matching Strava activity on sync.
- The coach may relabel a completed day with what was actually done, never its numbers.
- Plan weeks run Monday–Sunday; runs before the plan start are week 0.
