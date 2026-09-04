# Splits upload

## Why it exists

Strava's API gives one set of numbers per activity: distance, moving time,
average pace, average heart rate. For an easy run that's the whole story. For
an interval session it's close to useless — 4x800m with jog recoveries syncs
as "5.7 km at 6:59/km", a pace that was never run for a single step.

The watch has the per-rep detail, but it doesn't leave the watch. So the
athlete screenshots the splits (or "segments") table and uploads it here.

## How it works

1. **Upload** (`/splits`) — one or more screenshots of the same scrolled list,
   the date of the run, and an optional note. Files go to Convex storage;
   `splits.createUpload` inserts a `splitUploads` row with status `processing`
   and links it to that date's workout (the completed run if there is one,
   otherwise the planned row, so an upload made before the Strava sync lands
   still attaches to the right session).

2. **Read** (`splitsActions.extractSplits`) — the images go to Claude with a
   forced `record_splits` tool call. The model's job is strictly
   transcription: distance, time, the pace column *verbatim*, heart rate, and
   a label for each row (`warmup` / `work` / `recovery` / `steady` /
   `cooldown`).

3. **Derive** (`lib/splitParsing.ts`) — pace and totals are computed from
   distance and time in code, never transcribed. Rows with an unreadable
   distance or time are dropped rather than guessed at, and the remaining rows
   are renumbered.

4. **Cross-check** — the transcribed pace column is parsed and compared to the
   computed pace. Beyond `max(5 s/km, 2%)` the row is flagged `paceMismatch`,
   which surfaces as a warning in the UI and as an explicit caveat in the text
   the coach reads. That tolerance absorbs the watch's own rounding (a 121 m
   segment carries a few s/km of it) while still catching a misread digit.

## Where the splits go

- **The Splits tab** — full table per upload, work reps called out.
- **The workout dialog** — the day's splits under the completed session.
- **The AI coach** — `getCoachContext` includes ready uploads from the last 14
  days as `SPLIT UPLOADS`, one line per split; the weekly review gets the
  reviewed week's; and the `get_splits` tool fetches any older range, so the
  coach can compare today's reps against the same session weeks ago. The
  system prompt tells it to judge quality sessions on the reps rather than the
  session average.
- **A human coach** — "Send to coach" opens the phone's share sheet with the
  formatted text *and* the original screenshots attached, so they can check
  the transcription against the source. Off a phone it copies the same text to
  the clipboard.

The shared text and the coach's context come from the same formatter
(`formatSplitsReport` / `splitsForPrompt`), so what a person is sent is what
the app reasoned about.

## Cost

Reading a screenshot is an Anthropic API call billed to `ANTHROPIC_API_KEY` in
the Convex deployment — the same key the coach uses. A Claude.ai or Claude Code
subscription does not cover it. That's why the tab sits behind `COACH_PASSCODE`
like the other actions that spend credit.
