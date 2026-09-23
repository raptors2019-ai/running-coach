/**
 * The daily breathwork routine. Fifteen minutes a day happens off your feet
 * (morning + evening, plus a short primer before hard runs); the running
 * patterns ride along inside runs that are already on the plan, so they add
 * no time.
 */

export type DrillId = "wake" | "sleep" | "primer" | "zone2" | "hard" | "race" | "swim";

export type Drill = {
  id: DrillId;
  name: string;
  when: string;
  minutes?: number;
  why: string;
  steps: string[];
  caution?: string;
};

export const DRILLS: Record<DrillId, Drill> = {
  wake: {
    id: "wake",
    name: "Morning rhythm walk",
    when: "On waking, before your phone",
    minutes: 5,
    why:
      "Makes the 3:2 and 2:1 step patterns automatic when nothing is at stake, so on race day switching between them is a habit rather than something you have to think about.",
    steps: [
      "Sit on the edge of the bed. 5 slow breaths through the nose into your belly, hand on your stomach. The hand should move more than your chest.",
      "Breath-hold check (BOLT): after a normal exhale, pinch your nose and count the seconds until the first urge to breathe. Stop at that urge, not at your max. Note the number; 20+ is solid, and it tends to creep up over weeks.",
      "Walk around the house or on the spot for 3 minutes: in through the nose for 3 steps, out for 2. Count quietly: in-2-3, out-2.",
      "Last minute: switch to 2:1, meaning in for 2 steps and out for 1, through the mouth with a firm, complete exhale. This is your race gear. Practise the switch a few times: 3:2 → 2:1 → 3:2.",
    ],
  },
  sleep: {
    id: "sleep",
    name: "Pre-sleep downshift",
    when: "In bed, lights off",
    minutes: 10,
    why:
      "Slow breathing at about 6 breaths a minute is the pattern with the best evidence for calming the nervous system and raising heart-rate variability. Better sleep is the biggest legal performance boost in a taper.",
    steps: [
      "Lie on your back, one hand on your belly.",
      "Breathe in through the nose for 4 counts, out through the nose for 6. That's about 6 breaths a minute. If 4/6 feels strained, use 3/5 and build up.",
      "Keep the exhale soft and slow. The long exhale is what does the work.",
      "For the last minute, take 3 physiological sighs (a full breath in through the nose, a short second sip on top, a long slow exhale through the mouth), then let your breathing go and don't control it any more.",
    ],
  },
  primer: {
    id: "primer",
    name: "Pre-run primer",
    when: "After the warm-up, right before the first rep (or in the start corral)",
    minutes: 2,
    why:
      "Settles pre-effort nerves without making you sleepy, and cues the rhythm you'll open with.",
    steps: [
      "3 physiological sighs: a full breath in through the nose, a short second sip on top to fill the lungs completely, then a long slow exhale through the mouth.",
      "1 minute walking or jogging on the spot in 3:2.",
      "Last 20 seconds: a few breaths of 2:1 with a firm exhale, then go.",
    ],
  },
  zone2: {
    id: "zone2",
    name: "Zone 2 runs: nasal + 3:2",
    when: "During easy runs, long runs and partner runs (no extra time)",
    why:
      "Breathing through your nose limits how hard you can go. If you can't keep your mouth closed, you're above zone 2. The 3:2 rhythm also alternates which foot lands on the exhale, which helps prevent side stitches.",
    steps: [
      "First 10 minutes: nose only. If you need to open your mouth, slow down until you don't. That's the whole rule.",
      "Settle into 3:2: in for 3 steps, out for 2. Nose or mouth, whichever holds the rhythm.",
      "Check in every kilometre: is the count still clean? If you've lost it, that usually means you've drifted too fast.",
      "On strides: switch to 2:1 with a strong exhale for the 20 seconds, then back to 3:2 on the walk back. Same switch as the morning drill.",
    ],
  },
  hard: {
    id: "hard",
    name: "Hard runs: 2:1, exhale first",
    when: "Intervals, tempo and race-pace sessions",
    why:
      "At 5K effort your body sets the breathing rate and counting in 3:2 won't keep up. What you can control is emptying your lungs fully. Most people under-exhale when they're hurting, and that's what makes it feel like you can't get a breath in.",
    steps: [
      "Warm-up: 3:2, relaxed. Do the pre-run primer before the first rep.",
      "Reps: 2:1, mouth open, breathe into your belly. Think 'out' more than 'in'; if the exhale is full, the inhale takes care of itself.",
      "If it goes ragged: take 3 hard, complete exhales in a row to reset, then pick 2:1 back up. Drop your shoulders and unclench your jaw on each exhale.",
      "Recoveries: start each one with 2 physiological sighs, then breathe through your nose if you can. It brings your heart rate down faster.",
      "Final rep: stop counting. Just exhale fully every breath.",
      "After: 2 minutes lying down on 4-in/6-out before you get up.",
    ],
  },
  race: {
    id: "race",
    name: "Race day: the breathing plan",
    when: "Sunday October 4",
    why:
      "Maps the rhythms onto your race plan so the 3km checkpoint has an objective test: is 2:1 still clean?",
    steps: [
      "Corral: 2–3 physiological sighs. Nothing else. Don't hyperventilate to 'get pumped'.",
      "Km 1 (4:55): 3:2 if you can hold it. If you can hold 3:2 at 4:55, you're calm and on pace.",
      "Km 2 (4:49): switch to 2:1 before you have to. Firm, complete exhales.",
      "3km checkpoint (14:31): is 2:1 still rhythmic with full exhales? Yes → green light, 4:46 / 4:42. Ragged or gasping → bail-out, 4:52 / 4:48.",
      "Km 5: no counting. Exhale hard, drop the shoulders, go.",
    ],
  },
  swim: {
    id: "swim",
    name: "Swim: bilateral breathing",
    when: "Easy swims on rest days",
    why:
      "Breathing every 3 strokes is a timed-exhale drill. It trains a steady, complete exhale under a little pressure, which is the same skill as 2:1 on the run.",
    steps: [
      "Easy pace only, 20–30 minutes.",
      "Breathe every 3 strokes, alternating sides. Trickle the exhale out steadily underwater so you only need to inhale when you turn.",
      "If every 3 is too much, use every 2 and add a length of 3s when you're settled.",
    ],
    caution:
      "No breath-hold or hypoxic sets in the water. Holding your breath after heavy breathing can cause shallow-water blackout without warning. Do breath holds only on dry land, sitting down, and never while driving.",
  },
};

export type DayKind = "off" | "easy" | "hard" | "race";

const HARD_TYPES = new Set(["tempo", "intervals", "race_pace"]);
const EASY_TYPES = new Set(["easy", "long", "shakeout", "run"]);

/** Strava can relabel a completed day ("run"); the plan's type decides the routine. */
export function dayKind(workout: { type: string; originalType?: string } | null | undefined): DayKind {
  if (!workout) return "off";
  const type = workout.originalType ?? workout.type;
  if (type === "race") return "race";
  if (HARD_TYPES.has(type)) return "hard";
  if (EASY_TYPES.has(type)) return "easy";
  return "off";
}

export type RoutineBlock = { drill: DrillId; minutes?: number; label: string };

export type DailyRoutine = {
  kind: DayKind;
  focus: string;
  /** Minutes of dedicated breathwork, not counting patterns done inside a run. */
  dedicatedMinutes: number;
  blocks: RoutineBlock[];
};

export function dailyRoutine(kind: DayKind): DailyRoutine {
  const wake: RoutineBlock = { drill: "wake", minutes: 5, label: "Morning rhythm walk" };
  let blocks: RoutineBlock[];
  let focus: string;
  switch (kind) {
    case "hard":
      focus = "Hard session: primer before the first rep, 2:1 with full exhales, sighs in recoveries.";
      blocks = [
        wake,
        { drill: "primer", minutes: 2, label: "Pre-run primer" },
        { drill: "hard", label: "During the session: 2:1, exhale first" },
        { drill: "sleep", minutes: 8, label: "Pre-sleep downshift" },
      ];
      break;
    case "race":
      focus = "Race day: primer in the corral, 3:2 → 2:1 by km 2, checkpoint at 3km.";
      blocks = [
        wake,
        { drill: "primer", minutes: 2, label: "Corral primer" },
        { drill: "race", label: "The race breathing plan" },
        { drill: "sleep", minutes: 8, label: "Pre-sleep downshift (you earned it)" },
      ];
      break;
    case "easy":
      focus = "Easy run: nose only for the first 10 minutes, then 3:2. Can't keep your mouth closed? Slow down.";
      blocks = [
        wake,
        { drill: "zone2", label: "During the run: nasal + 3:2" },
        { drill: "sleep", minutes: 10, label: "Pre-sleep downshift" },
      ];
      break;
    default:
      focus = "Off-feet day: the 3:2 → 2:1 switch in the morning, the long exhale at night.";
      blocks = [
        wake,
        { drill: "sleep", minutes: 10, label: "Pre-sleep downshift" },
        { drill: "swim", label: "If you swim: bilateral breathing, easy" },
      ];
  }
  const dedicatedMinutes = blocks.reduce((sum, b) => sum + (b.minutes ?? 0), 0);
  return { kind, focus, dedicatedMinutes, blocks };
}
