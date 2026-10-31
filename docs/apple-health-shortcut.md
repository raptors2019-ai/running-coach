# Apple Health → Running Coach (iPhone Shortcut)

Strava auto-sync is off. Workouts of **every type** (runs, walks, rides, swims,
lifts, basketball, HIIT, yoga…) are pushed from the iPhone by a Shortcut to a
Convex HTTP endpoint:

```
POST https://precious-whale-612.convex.site/apple-health/workout
Header: X-Ingest-Secret: <APPLE_INGEST_SECRET>
Body:   one workout as JSON (format below)
```

`precious-whale-612` is the deployment production uses (see CLAUDE.md). HTTP
actions are served from `.convex.site`, not `.convex.cloud`.

## 1. Set the secret (once)

```sh
# Generate a long random secret and store it on the Convex deployment.
# .env.local points `npx convex` at precious-whale-612, i.e. production.
npx convex env set APPLE_INGEST_SECRET "$(openssl rand -hex 32)"
npx convex env get APPLE_INGEST_SECRET   # copy this into the Shortcut
```

While `APPLE_INGEST_SECRET` is unset every request gets `401`. The endpoint
compares the header in constant time and never logs the secret or the payload.

The function code ships with `npx convex dev --once`; the endpoint does not
exist on the deployment until that's been run.

## 2. Build the Shortcuts

Two shortcuts and two personal automations. All of it lives on the phone.

### Shortcut A: "Send Workout to Coach"

Takes one workout as input. If it gets no input, it sends the latest workout.

1. **Shortcuts → + → name it "Send Workout to Coach"**. In the shortcut's
   details (ⓘ), turn on **Receive input**: types *Health Samples*; *If there's
   no input*: **Continue**.
2. **If** *Shortcut Input* **has any value**
   - **Set Variable** `Workout` to *Shortcut Input*
3. **Otherwise**
   - **Find Health Samples** where *Type* is **Workouts**, sort by *Start Date*,
     *Latest First*, *Limit* **1**
   - **Set Variable** `Workout` to *Health Samples*
4. **End If**
5. **Find Health Samples** where *Type* is **Heart Rate**, *Start Date* is after
   `Workout` › *Start Date*, *End Date* is before `Workout` › *End Date*,
   sort *Start Date* *Oldest First*. Set it to variable `HR`.
6. **Repeat with Each** item in `HR`:
   - **Text**: `["` *Repeat Item › Start Date* (tap it → Date Format **ISO 8601**,
     include time) `",` *Repeat Item › Value* `]`
7. **End Repeat**. **Combine Text** (*Repeat Results*) with **Custom** separator `,`.
   Set it to variable `HRList`.
8. **Find Health Samples** where *Type* is **Active Energy**, same start/end
   filters as step 5. **Calculate Statistics** → **Sum** → variable `ActiveKcal`.
9. Optional, in the same way (Find Health Samples → Calculate Statistics):
   - **Resting Energy** → Sum, then **Calculate** `ActiveKcal + it` → `TotalKcal`
   - **Steps** → Sum → `Steps`
   - **Walking + Running Distance**, **Cycling Distance** or **Swimming Distance**
     → Sum → `DistanceKm` (set the unit to km). Only one of them is non-zero
     for any given workout, so you can add all three.
   - **Running Power** or **Cycling Power** → Average → `PowerW`
   - **Cycling Cadence** → Average → `Cadence`
10. **Text** (the payload; tap each variable to insert it, and set both dates
    to Date Format **ISO 8601** with time):

    ```json
    {
      "id": "<Workout.Start Date ISO 8601>-<Workout.Type>",
      "type": "<Workout.Type>",
      "start": "<Workout.Start Date ISO 8601>",
      "end": "<Workout.End Date ISO 8601>",
      "durationS": "<Workout.Duration (seconds)>",
      "distanceKm": "<DistanceKm>",
      "activeEnergyKcal": "<ActiveKcal>",
      "totalEnergyKcal": "<TotalKcal>",
      "steps": "<Steps>",
      "avgPowerW": "<PowerW>",
      "avgCadence": "<Cadence>",
      "device": "<Workout.Source>",
      "hr": [<HRList>]
    }
    ```

    Leave a field out (or empty) when you didn't compute it. The `id` must come
    out identical every time the same workout is sent, which is why it's
    built from the start date and type. That makes re-sends harmless.
11. **Text**: paste the secret. Set it to variable `Secret`.
12. **Get Contents of URL**
    - URL `https://precious-whale-612.convex.site/apple-health/workout`
    - Method **POST**
    - Headers: `X-Ingest-Secret` = `Secret`, `Content-Type` = `application/json`
    - Request Body **File** = the payload *Text* from step 10

Don't share this shortcut: the secret sits in it as plain text. If it leaks,
set a new one (step 1) and paste the new value into step 11.

### Shortcut B: "Coach Catch-up"

1. **Find Health Samples** where *Type* is **Workouts** and *Start Date* is
   **in the last 1 day**, no type filter (all workout types), sort *Oldest First*.
2. **Repeat with Each** item in *Health Samples*:
   - **Run Shortcut** "Send Workout to Coach", input *Repeat Item*,
     *Show While Running* off.
3. **End Repeat**

### Automations (Shortcuts → Automation → + → Personal Automation)

1. **Apple Watch Workout** → **Ends** → choose **every** workout type (or
   *Any Workout*) → **Run Immediately** → action **Run Shortcut** "Send Workout
   to Coach" with no input.
2. **Time of Day** → **10:00 PM**, **Daily** → **Run Immediately** → **Run
   Shortcut** "Coach Catch-up". This picks up anything the end-of-workout push
   missed (phone locked, no signal, the Watch synced late). Workouts already
   received are skipped by id.

Heart-rate loops are slow. A 2-hour basketball game has about 1,500 samples, so
step 6 can take a while. The server accepts the workout without `hr` and works
out average, max and min heart rate from the series when you send one.

## 3. Payload

One JSON object. Values can be numbers or text with units and thousands
separators (`"1,012 kcal"`, `"8.02 km"`, `"3.1 mi"`, `"45 min"`, `"1:02:03"`).

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable per workout; stored as `ah:<id>`. Re-sending the same id does nothing. |
| `type` | yes | Any Apple workout type string, e.g. `Running`, `Traditional Strength Training`, `Basketball`, `HKWorkoutActivityTypeYoga`. |
| `start` | yes | ISO 8601 (`2026-10-31T07:05:00-04:00`), epoch s/ms, or Shortcuts text (`Oct 31, 2026 at 7:05 AM`). Text without a zone is read as Toronto time. |
| `end` | one of end/durationS | Same formats. |
| `durationS` | one of end/durationS | Seconds, `mm:ss`, `h:mm:ss`, or `"1 hr, 5 min"`. |
| `distanceKm` | no | km by default; `mi` and `m` are converted. Leave it out for non-distance workouts. |
| `avgHR`, `maxHR`, `minHR` | no | bpm. Worked out from `hr` when missing. |
| `hr` | no | `[[t, bpm], …]`. `t` is seconds from start, or a date. `{date, value}` objects also work. Downsampled to 600 points. |
| `activeEnergyKcal`, `totalEnergyKcal` | no | kcal (kJ converted). |
| `steps`, `elevationGainM`, `avgCadence`, `avgPowerW`, `mets` | no | Numbers. |
| `indoor` | no | `true`/`false`/`"Yes"`/`"No"`/`"Indoor"`/`"Outdoor"`. |
| `location`, `weather`, `device` (or `source`) | no | Text or an object (stored as JSON, ≤300 chars). |
| `name` | no | Activity name. Default is Strava-style: "Evening Traditional Strength Training", "Night Basketball". |
| `laps` (or `segments`) | no | `[{label?, start? or startS?, durationS?, distanceKm?, avgHR?, maxHR?}]`, ≤200. |
| `route` | no | `[[lat, lng, ele?], …]` or `{lat, lng, ele}`. Downsampled to 1,000 points. |
| anything else | no | Kept as JSON in `activityDetails.raw`, capped at 8,000 chars (fields that don't fit are listed in `_dropped`). |

Responses: `200 {status: "created" | "duplicate" | "duplicate_of_strava", activityId, date, …}`,
`400 {error}` for an unusable payload (no id/type/start/duration, bad JSON),
`401` for a missing or wrong secret, `413` over 2 MB.

### Which fields each workout type can supply via Shortcuts

✓ = available from Health samples (step 9). – = Apple doesn't record it for
that type. ✗ = Health records it, but Shortcuts can't read it.

| Workout type (→ app type) | distance | HR series / avg / max | active & total kcal | steps | power | cadence | route, laps, elevation |
|---|---|---|---|---|---|---|---|
| Running, indoor/outdoor (→ run) | ✓ Walking + Running Distance | ✓ | ✓ | ✓ | ✓ Running Power | steps ÷ minutes | ✗ |
| Walking, Hiking (→ rest / cross_training) | ✓ Walking + Running Distance | ✓ | ✓ | ✓ | – | – | ✗ |
| Cycling, indoor/outdoor (→ cross_training) | ✓ Cycling Distance | ✓ | ✓ | – | ✓ with a power meter | ✓ with a sensor | ✗ |
| Swimming, pool/open water (→ swim) | ✓ Swimming Distance | ✓ (patchy underwater) | ✓ | – | – | – | ✗ |
| Traditional/Functional Strength (→ cross_training, or upper/lower body by name) | – | ✓ | ✓ | – | – | – | – |
| Basketball and other sports (→ cross_training) | – | ✓ | ✓ | ✓ | – | – | – |
| HIIT, Core, Cross Training, Mixed Cardio (→ cross_training) | – | ✓ | ✓ | ✓ | – | – | – |
| Yoga, Pilates, Mind & Body (→ cross_training) | – | ✓ | ✓ | – | – | – | – |
| Elliptical, Stair Stepper, Rowing (→ cross_training) | – | ✓ | ✓ | ✓ | – | – | – |

Weather and location: Shortcuts can't read the workout's own weather metadata.
The end-of-workout automation can add **Get Current Weather** and **Get
Current Location** results as `weather` and `location`. Leave them out of the
catch-up.

## 4. What the server does with it

- **Type mapping:** `mapAppleType` turns the Apple type into the matching Strava
  type (Running→Run, Walking→Walk, Cycling→Ride, Swimming→Swim, strength→
  WeightTraining, Yoga→Yoga, HIIT→HighIntensityIntervalTraining, and
  Basketball or anything unknown→Workout). It then goes through the existing
  `mapStravaTypeToWorkoutType`, so an Apple lift lands exactly where Strava's
  "Evening Weight Training" did (cross_training, or upper/lower body by name).
- **Workouts row:** the workout goes through the same matching as a Strava
  activity (`autoCompleteFromActivities` logic) with `stravaActivityId =
  "ah:<id>"`. It completes the day's planned row or becomes an unplanned row.
  Date and start time are Toronto local.
- **Detail:** everything lands in `activityDetails` (keyed by `activityId`, linked
  by `workoutId`). The coach sees an `activity` summary on each linked row:
  HR, minutes per HR band, HR per quarter, and energy.
- **Dedupe:**
  - The same `id` is idempotent.
  - When a Strava-synced row on the same date records the same workout, no
    second row is made; the detail is stored against the Strava row
    (`duplicateOf`). Strava `workouts` rows don't store a start time. The start
    comes from `activityRoutes` (GPS activities only) and must be within 5
    minutes. Without it, the fallback is the same kind (run vs non-run) with
    durations within max(5 min, 10%).
  - The reverse also holds: a manual Strava sync skips activities starting
    within 5 minutes of a stored Apple workout.
- **Laps:** stored in `activityDetails.laps` only. They are *not* written to
  `splitUploads`: that table needs screenshot `images` (required) and is
  filled by the extraction pipeline, so Apple laps don't fit it cleanly. The
  coach's split detail still comes from screenshot uploads.
- **rematch_date:** the coach's rematch clears the day and then re-imports the
  day's stored Apple workouts together. The Shortcut pushes once, so there's
  nothing to re-fetch.

## 5. Test with curl

```sh
URL=https://precious-whale-612.convex.site/apple-health/workout

# 401: wrong secret (writes nothing)
curl -i -X POST "$URL" -H "X-Ingest-Secret: nope" -d '{}'

# 400: authorised but unusable payload (writes nothing)
curl -i -X POST "$URL" -H "X-Ingest-Secret: $APPLE_INGEST_SECRET" \
  -H "Content-Type: application/json" -d '{"id":"x","type":"Running"}'

# 200: a real workout. This writes to the LIVE deployment (a workouts row and an
# activityDetails row), so use a real workout or delete the rows afterwards.
curl -i -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Secret: $APPLE_INGEST_SECRET" \
  -d '{
    "id": "2026-10-30T18:10:00-04:00-Traditional Strength Training",
    "type": "Traditional Strength Training",
    "start": "Oct 30, 2026 at 6:10 PM",
    "end": "2026-10-30T19:05:00-04:00",
    "activeEnergyKcal": "312 kcal",
    "totalEnergyKcal": "395 kcal",
    "hr": [[0, 92], [600, 118], [1800, 131], [3000, 104]]
  }'
# Send it again: {"status":"duplicate", ...}
```
