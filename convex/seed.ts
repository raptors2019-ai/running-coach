import { mutation } from "./_generated/server";
import { v } from "convex/values";

interface WorkoutData {
  date: string;
  weekNumber: number;
  dayOfWeek: string;
  type: string;
  title: string;
  description: string;
  targetDistance?: number;
  targetPace?: string;
  intervals?: { distance: string; pace: string; rest: string; reps: number }[];
}

const TRAINING_PLAN: WorkoutData[] = [
  // Week 1: Rebuild + Benchmark (Aug 25-30) — ~14 km
  { date: "2026-08-25", weekNumber: 1, dayOfWeek: "Tue", type: "easy", title: "Easy Run + Strides", description: "4km easy @ 6:45-7:15 + 4x100m strides. You've been cruising 2ks — this is that plus strides to wake the legs up for Thursday.", targetDistance: 4, targetPace: "6:45-7:15" },
  { date: "2026-08-26", weekNumber: 1, dayOfWeek: "Wed", type: "upper_body", title: "Upper Body", description: "Upper body lift. No running — legs stay fresh for tomorrow's benchmark." },
  { date: "2026-08-27", weekNumber: 1, dayOfWeek: "Thu", type: "race_pace", title: "BENCHMARK: 2K Time Trial", description: "WU 1.5km + 2km hard (controlled all-out) + CD 1km. This calibrates the whole plan. Under 9:50 (4:55/km) → chase 24:30. 9:50-10:30 → sub-25 is the goal. Over 10:30 → we build and retest week 3.", targetDistance: 4.5, targetPace: "4:45-5:15" },
  { date: "2026-08-28", weekNumber: 1, dayOfWeek: "Fri", type: "lower_body", title: "Lower Body", description: "Lower body lift. No running." },
  { date: "2026-08-29", weekNumber: 1, dayOfWeek: "Sat", type: "easy", title: "Partner Easy Run", description: "2-3km truly conversational with your gf. This counts as real recovery volume — don't sneak the pace down.", targetDistance: 2.5, targetPace: "7:00+" },
  { date: "2026-08-30", weekNumber: 1, dayOfWeek: "Sun", type: "long", title: "Zone 2 Run", description: "5km @ 6:45-7:15. Relaxed, nasal-breathing effort. Moveable to Monday if the weekend gets busy.", targetDistance: 5, targetPace: "6:45-7:15" },

  // Week 2: Raw Speed (Aug 31 - Sep 6) — ~19 km
  { date: "2026-08-31", weekNumber: 2, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body", description: "Upper body lift. No running." },
  { date: "2026-09-01", weekNumber: 2, dayOfWeek: "Tue", type: "intervals", title: "Speed: 8x400m", description: "WU 1.5km + 8x400m @ 4:45-4:55/km (90s jog rest) + CD 1km. Short and fast — each rep is under 2 minutes of work. Hit the pace, don't hero the first two reps.", targetDistance: 7, targetPace: "4:45-4:55", intervals: [{ distance: "400m", pace: "4:45-4:55/km", rest: "90s jog", reps: 8 }] },
  { date: "2026-09-02", weekNumber: 2, dayOfWeek: "Wed", type: "lower_body", title: "Lower Body", description: "Lower body lift, day after speed — hard days hard, easy days easy." },
  { date: "2026-09-03", weekNumber: 2, dayOfWeek: "Thu", type: "easy", title: "Zone 2 Run", description: "5km @ 6:45-7:15. Legs may feel Wednesday's lift — that's fine, keep it genuinely easy.", targetDistance: 5, targetPace: "6:45-7:15" },
  { date: "2026-09-04", weekNumber: 2, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest or easy swim." },
  { date: "2026-09-05", weekNumber: 2, dayOfWeek: "Sat", type: "easy", title: "Partner Easy Run", description: "2-3km conversational with your gf.", targetDistance: 2.5, targetPace: "7:00+" },
  { date: "2026-09-06", weekNumber: 2, dayOfWeek: "Sun", type: "long", title: "Zone 2 Long Run", description: "6km @ 6:30-7:00. Building the aerobic floor that lets you hold 5:00/km on race day.", targetDistance: 6, targetPace: "6:30-7:00" },

  // Week 3: VO2max (Sep 7-13) — ~20 km
  { date: "2026-09-07", weekNumber: 3, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body", description: "Upper body lift. No running." },
  { date: "2026-09-08", weekNumber: 3, dayOfWeek: "Tue", type: "intervals", title: "VO2max: 5x800m", description: "WU 1.5km + 5x800m @ 4:50-5:00/km (2:30 jog rest) + CD 1km. Twice the rep length of last week at nearly the same pace — this is the engine-builder for a 5K.", targetDistance: 7, targetPace: "4:50-5:00", intervals: [{ distance: "800m", pace: "4:50-5:00/km", rest: "2:30 jog", reps: 5 }] },
  { date: "2026-09-09", weekNumber: 3, dayOfWeek: "Wed", type: "lower_body", title: "Lower Body", description: "Lower body lift, day after speed." },
  { date: "2026-09-10", weekNumber: 3, dayOfWeek: "Thu", type: "easy", title: "Zone 2 Run + Strides", description: "5km @ 6:45-7:15 + 4x100m strides at the end.", targetDistance: 5, targetPace: "6:45-7:15" },
  { date: "2026-09-11", weekNumber: 3, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest or easy swim." },
  { date: "2026-09-12", weekNumber: 3, dayOfWeek: "Sat", type: "easy", title: "Partner Easy Run", description: "2-3km conversational with your gf.", targetDistance: 2.5, targetPace: "7:00+" },
  { date: "2026-09-13", weekNumber: 3, dayOfWeek: "Sun", type: "long", title: "Zone 2 Long Run", description: "7km @ 6:30-7:00. Longest run of the plan. If you missed a run this week, this is the one to protect.", targetDistance: 7, targetPace: "6:30-7:00" },

  // Week 4: Race Pace Test (Sep 14-20) — ~19 km
  { date: "2026-09-14", weekNumber: 4, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body", description: "Upper body lift. Legs fresh for tomorrow — THE key workout of the plan." },
  { date: "2026-09-15", weekNumber: 4, dayOfWeek: "Tue", type: "race_pace", title: "RACE PACE TEST: 3K @ 5:00", description: "WU 1.5km + 3km continuous @ 5:00/km + CD 1km. The April formula: controlled-but-hard → sub-25 is locked. Felt easy → target 24:15-24:30. Couldn't hold past 2km → we race for 25:30 with a negative split.", targetDistance: 5.5, targetPace: "5:00" },
  { date: "2026-09-16", weekNumber: 4, dayOfWeek: "Wed", type: "lower_body", title: "Lower Body", description: "Lower body lift, day after the test." },
  { date: "2026-09-17", weekNumber: 4, dayOfWeek: "Thu", type: "easy", title: "Zone 2 Run", description: "5-6km @ 6:45-7:15.", targetDistance: 6, targetPace: "6:45-7:15" },
  { date: "2026-09-18", weekNumber: 4, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest or easy swim." },
  { date: "2026-09-19", weekNumber: 4, dayOfWeek: "Sat", type: "easy", title: "Partner Easy Run", description: "2-3km conversational with your gf.", targetDistance: 2.5, targetPace: "7:00+" },
  { date: "2026-09-20", weekNumber: 4, dayOfWeek: "Sun", type: "long", title: "Zone 2 Long Run", description: "7km @ 6:30-7:00. Last long one — volume starts dropping from here.", targetDistance: 7, targetPace: "6:30-7:00" },

  // Week 5: Sharpen (Sep 21-27) — ~18 km
  { date: "2026-09-21", weekNumber: 5, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body", description: "Upper body lift. No running." },
  { date: "2026-09-22", weekNumber: 5, dayOfWeek: "Tue", type: "tempo", title: "The April Special: 4x1km", description: "WU 1.5km + 4x1km @ 4:50-5:00/km (90s jog rest) + CD 1km. Same structure that got you to Foxtrail fitness, at 5K pace. Hold goal pace under fatigue — this is the race in disguise.", targetDistance: 7.5, targetPace: "4:50-5:00", intervals: [{ distance: "1000m", pace: "4:50-5:00/km", rest: "90s jog", reps: 4 }] },
  { date: "2026-09-23", weekNumber: 5, dayOfWeek: "Wed", type: "lower_body", title: "Lower Body", description: "Lower body lift — LAST hard leg day before the race." },
  { date: "2026-09-24", weekNumber: 5, dayOfWeek: "Thu", type: "easy", title: "Zone 2 Run + Strides", description: "5km @ 6:45-7:15 + 4x100m strides.", targetDistance: 5, targetPace: "6:45-7:15" },
  { date: "2026-09-25", weekNumber: 5, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest or easy swim." },
  { date: "2026-09-26", weekNumber: 5, dayOfWeek: "Sat", type: "easy", title: "Partner Easy Run", description: "2-3km conversational with your gf.", targetDistance: 2.5, targetPace: "7:00+" },
  { date: "2026-09-27", weekNumber: 5, dayOfWeek: "Sun", type: "easy", title: "Easy Zone 2", description: "5km @ 6:45-7:15. Taper begins — resist doing more.", targetDistance: 5, targetPace: "6:45-7:15" },

  // Week 6: Taper + Race (Sep 28 - Oct 4) — ~10 km + Race
  { date: "2026-09-28", weekNumber: 6, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body (Light)", description: "Light upper body only — last lift of the block. No legs this week." },
  { date: "2026-09-29", weekNumber: 6, dayOfWeek: "Tue", type: "easy", title: "Easy Run + Strides", description: "4km easy @ 6:45-7:15 + 4x100m strides. Stay loose, nothing hard.", targetDistance: 4, targetPace: "6:45-7:15" },
  { date: "2026-09-30", weekNumber: 6, dayOfWeek: "Wed", type: "rest", title: "Rest Day", description: "Full rest. You might feel sluggish — that's the taper working." },
  { date: "2026-10-01", weekNumber: 6, dayOfWeek: "Thu", type: "intervals", title: "Sharpener: 3x400m @ Race Pace", description: "WU 1km + 3x400m @ 5:00/km (full recovery) + CD 1km. Just touching race pace so it feels automatic Sunday. Should feel EASY — if it doesn't, you're going too fast.", targetDistance: 3.5, targetPace: "5:00", intervals: [{ distance: "400m", pace: "5:00/km", rest: "full recovery", reps: 3 }] },
  { date: "2026-10-02", weekNumber: 6, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest. Hydrate, sleep." },
  { date: "2026-10-03", weekNumber: 6, dayOfWeek: "Sat", type: "shakeout", title: "Shakeout Run", description: "2km very easy + 2x100m strides — perfect partner run. Lay out race gear tonight.", targetDistance: 2, targetPace: "7:15+" },
  { date: "2026-10-04", weekNumber: 6, dayOfWeek: "Sun", type: "race", title: "RACE DAY — Oakville 5K", description: "Coronation Park. Km 1: 5:03 (hold back — April taught us the adrenaline trap). Km 2-4: lock 5:00. Km 5: empty the tank, 4:45-4:50. Target: 24:50.", targetDistance: 5, targetPace: "5:00" },
];

export const reseedTrainingPlan = mutation({
  handler: async (ctx) => {
    // Completed workouts (April 10K block, Foxtrail race, synced Strava runs)
    // and their journal entries are kept as history. They stay attached to
    // their old planId, so week views — which scope by the current plan's id —
    // only show the new plan, while date-based views still show everything.
    const workouts = await ctx.db.query("workouts").collect();
    const journals = await ctx.db.query("journalEntries").collect();
    for (const w of workouts) {
      if (w.completed) continue;
      for (const j of journals) {
        if (j.workoutId === w._id) await ctx.db.delete(j._id);
      }
      await ctx.db.delete(w._id);
    }
    const plans = await ctx.db.query("trainingPlan").collect();
    for (const p of plans) await ctx.db.delete(p._id);

    // Create fresh plan
    const planId = await ctx.db.insert("trainingPlan", {
      name: "Oakville 5K - Sub 25",
      startDate: "2026-08-25",
      raceDate: "2026-10-04",
      goalTime: 1500,
      currentPace: "7:00",
      goalPace: "5:00",
    });

    // Skip dates that already have a completed workout so re-running
    // mid-plan doesn't create duplicates alongside finished sessions.
    const completedDates = new Set(workouts.filter((w) => w.completed).map((w) => w.date));
    let inserted = 0;
    for (const workout of TRAINING_PLAN) {
      if (completedDates.has(workout.date)) continue;
      await ctx.db.insert("workouts", { planId, ...workout, completed: false });
      inserted++;
    }

    console.log(`Reseeded ${inserted} workouts (kept ${completedDates.size} completed dates as history)`);
    return planId;
  },
});

export const reseedFromDate = mutation({
  args: { cutoffDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cutoffDate = args.cutoffDate ?? "2026-08-25";

    // Get existing plan
    const plan = await ctx.db.query("trainingPlan").first();
    if (!plan) throw new Error("No training plan found. Run seedTrainingPlan first.");

    // Delete workouts from cutoff date onward
    const workouts = await ctx.db.query("workouts").collect();
    let deleted = 0;
    for (const w of workouts) {
      if (w.date >= cutoffDate) {
        // Also delete any journal entries for this workout
        const journals = await ctx.db.query("journalEntries").collect();
        for (const j of journals) {
          if (j.workoutId === w._id) await ctx.db.delete(j._id);
        }
        await ctx.db.delete(w._id);
        deleted++;
      }
    }

    // Re-insert workouts from cutoff date onward using updated plan
    const newWorkouts = TRAINING_PLAN.filter((w) => w.date >= cutoffDate);
    for (const workout of newWorkouts) {
      await ctx.db.insert("workouts", { planId: plan._id, ...workout, completed: false });
    }

    console.log(`Deleted ${deleted} workouts, inserted ${newWorkouts.length} from ${cutoffDate} onward`);
    return plan._id;
  },
});

export const seedTrainingPlan = mutation({
  handler: async (ctx) => {
    // Check if plan already exists
    const existing = await ctx.db.query("trainingPlan").first();
    if (existing) {
      console.log("Training plan already seeded");
      return existing._id;
    }

    // Create training plan
    const planId = await ctx.db.insert("trainingPlan", {
      name: "Oakville 5K - Sub 25",
      startDate: "2026-08-25",
      raceDate: "2026-10-04",
      goalTime: 1500, // 25 minutes in seconds
      currentPace: "7:00",
      goalPace: "5:00",
    });

    // Insert all workouts
    for (const workout of TRAINING_PLAN) {
      await ctx.db.insert("workouts", {
        planId,
        ...workout,
        completed: false,
      });
    }

    console.log(`Seeded ${TRAINING_PLAN.length} workouts`);
    return planId;
  },
});
