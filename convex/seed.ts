import { mutation } from "./_generated/server";

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
  // Phase 1: Reintroduce Running (Apr 3-6)
  { date: "2026-04-03", weekNumber: 1, dayOfWeek: "Fri", type: "easy", title: "Easy Run", description: "10-12km @ 7:00-7:30/km. First real run back - go genuinely easy. Pay attention to how legs feel at km 8+.", targetDistance: 11, targetPace: "7:00-7:30" },
  { date: "2026-04-04", weekNumber: 1, dayOfWeek: "Sat", type: "upper_body", title: "Upper Body + Easy Run", description: "Upper body lift AM. 5km easy @ 7:00-7:30 + 4x100m strides PM.", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-04-05", weekNumber: 1, dayOfWeek: "Sun", type: "rest", title: "Rest Day", description: "Full rest day. You ran 11km on Friday — aerobic base is proven." },
  { date: "2026-04-06", weekNumber: 1, dayOfWeek: "Mon", type: "lower_body", title: "Lower Body + Easy Run", description: "Lower body lift AM. 5km easy @ 7:00-7:30 PM to shake legs out after 2 days off. Keep it relaxed — race pace test tomorrow.", targetDistance: 5, targetPace: "7:00-7:30" },

  // Phase 2: Race Pace Test + Sharpening (Apr 7-10)
  { date: "2026-04-07", weekNumber: 2, dayOfWeek: "Tue", type: "race_pace", title: "RACE PACE TEST", description: "WU 1.5km + 5km @ 6:00/km + CD 1.5km. THE key workout. Lock in 6:00 and hold it. This tells you everything about race day.", targetDistance: 8, targetPace: "6:00" },
  { date: "2026-04-08", weekNumber: 2, dayOfWeek: "Wed", type: "upper_body", title: "Upper Body + Recovery Run", description: "Upper body lift. 4km recovery @ 7:15-7:45/km. Very easy shake-out.", targetDistance: 4, targetPace: "7:15-7:45" },
  { date: "2026-04-09", weekNumber: 2, dayOfWeek: "Thu", type: "tempo", title: "Tempo Intervals", description: "WU 1.5km + 4x1km @ 5:50-6:00/km (90s jog rest) + CD 1.5km. Teaches your body to hold race pace under fatigue.", targetDistance: 8, targetPace: "5:50-6:00", intervals: [{ distance: "1000m", pace: "5:50-6:00/km", rest: "90s jog", reps: 4 }] },
  { date: "2026-04-10", weekNumber: 2, dayOfWeek: "Fri", type: "lower_body", title: "Lower Body", description: "Lower body lift. No running. Last hard leg day before the race." },

  // Phase 3: Cottage Weekend + Taper (Apr 11-18)
  { date: "2026-04-11", weekNumber: 3, dayOfWeek: "Sat", type: "swim", title: "Cottage - Swim/Bike", description: "Cottage weekend. Swim or easy bike if available. No running needed.", },
  { date: "2026-04-12", weekNumber: 3, dayOfWeek: "Sun", type: "swim", title: "Cottage - Swim/Rest", description: "Swim, light walk, enjoy it. No running." },
  { date: "2026-04-13", weekNumber: 3, dayOfWeek: "Mon", type: "easy", title: "Easy + Strides", description: "5km easy @ 7:00-7:20 + 4x100m strides. Back from cottage, shake legs out.", targetDistance: 5, targetPace: "7:00-7:20" },
  { date: "2026-04-14", weekNumber: 3, dayOfWeek: "Tue", type: "swim", title: "Easy Swim", description: "20-30 min easy swim. Keeps cardio up, zero leg stress." },
  { date: "2026-04-15", weekNumber: 3, dayOfWeek: "Wed", type: "easy", title: "Easy + Strides", description: "4km easy + 3x100m strides. Last run with any speed.", targetDistance: 4, targetPace: "7:00-7:20" },
  { date: "2026-04-16", weekNumber: 3, dayOfWeek: "Thu", type: "swim", title: "Swim or Rest", description: "Easy swim if you want, or full rest. No running." },
  { date: "2026-04-17", weekNumber: 3, dayOfWeek: "Fri", type: "shakeout", title: "Shakeout Run", description: "3km very easy + 2x100m strides. Lay out race gear tonight.", targetDistance: 3, targetPace: "7:30+" },
  { date: "2026-04-18", weekNumber: 3, dayOfWeek: "Sat", type: "race", title: "RACE DAY - 10K", description: "Km 1: 6:05-6:10 (hold back). Km 2-8: 6:00 (find pacer, run YOUR pace). Km 9-10: push to 5:50-5:55 if you have it. You've done the work!", targetDistance: 10, targetPace: "6:00" },
];

export const reseedTrainingPlan = mutation({
  handler: async (ctx) => {
    // Delete all existing workouts and plans
    const workouts = await ctx.db.query("workouts").collect();
    for (const w of workouts) await ctx.db.delete(w._id);
    const plans = await ctx.db.query("trainingPlan").collect();
    for (const p of plans) await ctx.db.delete(p._id);
    const journals = await ctx.db.query("journalEntries").collect();
    for (const j of journals) await ctx.db.delete(j._id);

    // Create fresh plan
    const planId = await ctx.db.insert("trainingPlan", {
      name: "Mississauga 10K - Sub 60",
      startDate: "2026-03-05",
      raceDate: "2026-04-18",
      goalTime: 3600,
      currentPace: "7:25",
      goalPace: "6:00",
    });

    for (const workout of TRAINING_PLAN) {
      await ctx.db.insert("workouts", { planId, ...workout, completed: false });
    }

    console.log(`Reseeded ${TRAINING_PLAN.length} workouts`);
    return planId;
  },
});

export const reseedFromDate = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = "2026-04-05";

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
      name: "Mississauga 10K - Sub 60",
      startDate: "2026-03-05",
      raceDate: "2026-04-18",
      goalTime: 3600, // 60 minutes in seconds
      currentPace: "7:25",
      goalPace: "6:00",
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
