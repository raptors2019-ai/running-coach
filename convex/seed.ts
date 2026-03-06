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
  // Week 1 (Mar 5-11) - Baseline + Speed Intro (~25 km)
  { date: "2026-03-05", weekNumber: 1, dayOfWeek: "Thu", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km. First run of the plan - find your rhythm.", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-03-06", weekNumber: 1, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest. Stretch and hydrate." },
  { date: "2026-03-07", weekNumber: 1, dayOfWeek: "Sat", type: "intervals", title: "Speed Intervals", description: "WU 1.5km + 6x400m @ 5:30/km (90s rest) + CD 1.5km", targetDistance: 6, targetPace: "5:30", intervals: [{ distance: "400m", pace: "5:30/km", rest: "90s", reps: 6 }] },
  { date: "2026-03-08", weekNumber: 1, dayOfWeek: "Sun", type: "long", title: "Long Run", description: "8km @ 6:45-7:15/km. Steady and comfortable.", targetDistance: 8, targetPace: "6:45-7:15" },
  { date: "2026-03-09", weekNumber: 1, dayOfWeek: "Mon", type: "upper_body", title: "Upper Body", description: "Upper body strength session. Push-ups, rows, shoulder press." },
  { date: "2026-03-10", weekNumber: 1, dayOfWeek: "Tue", type: "tempo", title: "Tempo Run", description: "WU 1.5km + 3km @ 6:00-6:10/km + CD 1.5km", targetDistance: 6, targetPace: "6:00-6:10" },
  { date: "2026-03-11", weekNumber: 1, dayOfWeek: "Wed", type: "rest", title: "Rest Day", description: "Full rest. Recovery is training." },

  // Week 2 (Mar 12-18) - Build Volume + Speed (~36 km)
  { date: "2026-03-12", weekNumber: 2, dayOfWeek: "Thu", type: "easy", title: "Easy Run", description: "6km @ 7:00-7:30/km", targetDistance: 6, targetPace: "7:00-7:30" },
  { date: "2026-03-13", weekNumber: 2, dayOfWeek: "Fri", type: "intervals", title: "800m Repeats", description: "WU 1.5km + 5x800m @ 5:20-5:30/km (2min rest) + CD 1.5km", targetDistance: 8, targetPace: "5:20-5:30", intervals: [{ distance: "800m", pace: "5:20-5:30/km", rest: "2min", reps: 5 }] },
  { date: "2026-03-14", weekNumber: 2, dayOfWeek: "Sat", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km. Shake out the legs.", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-03-15", weekNumber: 2, dayOfWeek: "Sun", type: "long", title: "Long Run", description: "10km @ 6:40-7:10/km. Building endurance.", targetDistance: 10, targetPace: "6:40-7:10" },
  { date: "2026-03-16", weekNumber: 2, dayOfWeek: "Mon", type: "lower_body", title: "Lower Body", description: "Lower body strength session. Squats, lunges, calf raises." },
  { date: "2026-03-17", weekNumber: 2, dayOfWeek: "Tue", type: "tempo", title: "Tempo Run", description: "WU 1.5km + 4km @ 5:55-6:05/km + CD 1.5km", targetDistance: 7, targetPace: "5:55-6:05" },
  { date: "2026-03-18", weekNumber: 2, dayOfWeek: "Wed", type: "rest", title: "Rest Day", description: "Full rest." },

  // Week 3 (Mar 19-25) - Peak Volume (~38.5 km)
  { date: "2026-03-19", weekNumber: 3, dayOfWeek: "Thu", type: "upper_body", title: "Upper Body", description: "Upper body strength session. Bench, pull-ups, core work." },
  { date: "2026-03-20", weekNumber: 3, dayOfWeek: "Fri", type: "easy", title: "Easy Run", description: "6km @ 7:00-7:30/km", targetDistance: 6, targetPace: "7:00-7:30" },
  { date: "2026-03-21", weekNumber: 3, dayOfWeek: "Sat", type: "intervals", title: "1K Repeats", description: "WU 1.5km + 4x1000m @ 5:15-5:25/km (2.5min rest) + CD 1.5km", targetDistance: 8.5, targetPace: "5:15-5:25", intervals: [{ distance: "1000m", pace: "5:15-5:25/km", rest: "2.5min", reps: 4 }] },
  { date: "2026-03-22", weekNumber: 3, dayOfWeek: "Sun", type: "long", title: "Long Run", description: "11km @ 6:30-7:00/km. Longest run of the plan.", targetDistance: 11, targetPace: "6:30-7:00" },
  { date: "2026-03-23", weekNumber: 3, dayOfWeek: "Mon", type: "rest", title: "Rest Day", description: "Full rest after peak volume." },
  { date: "2026-03-24", weekNumber: 3, dayOfWeek: "Tue", type: "tempo", title: "Tempo Run", description: "WU 1.5km + 5km @ 5:50-6:00/km + CD 1.5km", targetDistance: 8, targetPace: "5:50-6:00" },
  { date: "2026-03-25", weekNumber: 3, dayOfWeek: "Wed", type: "easy", title: "Recovery Run", description: "5km recovery @ 7:15-7:45/km", targetDistance: 5, targetPace: "7:15-7:45" },

  // Week 4 (Mar 26-Apr 1) - Recovery/Deload (~24 km)
  { date: "2026-03-26", weekNumber: 4, dayOfWeek: "Thu", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-03-27", weekNumber: 4, dayOfWeek: "Fri", type: "rest", title: "Rest Day", description: "Full rest. Deload week." },
  { date: "2026-03-28", weekNumber: 4, dayOfWeek: "Sat", type: "tempo", title: "Tempo Run", description: "WU 1.5km + 3km @ 6:00/km + CD 1.5km", targetDistance: 6, targetPace: "6:00" },
  { date: "2026-03-29", weekNumber: 4, dayOfWeek: "Sun", type: "long", title: "Long Run", description: "8km @ 6:45-7:15/km", targetDistance: 8, targetPace: "6:45-7:15" },
  { date: "2026-03-30", weekNumber: 4, dayOfWeek: "Mon", type: "cross_training", title: "Cross-Training", description: "Light cross-training. Deload week - keep it easy." },
  { date: "2026-03-31", weekNumber: 4, dayOfWeek: "Tue", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-04-01", weekNumber: 4, dayOfWeek: "Wed", type: "rest", title: "Rest Day", description: "Full rest." },

  // Week 5 (Apr 2-8) - Sharpening (~35 km)
  { date: "2026-04-02", weekNumber: 5, dayOfWeek: "Thu", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-04-03", weekNumber: 5, dayOfWeek: "Fri", type: "race_pace", title: "Race Pace Run", description: "WU 1.5km + 6km @ 5:55-6:00/km + CD 1.5km. Practice holding race pace.", targetDistance: 9, targetPace: "5:55-6:00" },
  { date: "2026-04-04", weekNumber: 5, dayOfWeek: "Sat", type: "rest", title: "Rest Day", description: "Full rest." },
  { date: "2026-04-05", weekNumber: 5, dayOfWeek: "Sun", type: "long", title: "Long Run w/ Race Pace", description: "10km @ 6:30-7:00/km with middle 3km at race pace (6:00/km)", targetDistance: 10, targetPace: "6:30-7:00" },
  { date: "2026-04-06", weekNumber: 5, dayOfWeek: "Mon", type: "lower_body", title: "Lower Body", description: "Lower body strength. Squats, deadlifts, glute bridges." },
  { date: "2026-04-07", weekNumber: 5, dayOfWeek: "Tue", type: "intervals", title: "Fast 400s", description: "WU 1.5km + 8x400m @ 5:10-5:20/km (90s rest) + CD 1.5km", targetDistance: 7, targetPace: "5:10-5:20", intervals: [{ distance: "400m", pace: "5:10-5:20/km", rest: "90s", reps: 8 }] },
  { date: "2026-04-08", weekNumber: 5, dayOfWeek: "Wed", type: "easy", title: "Recovery Run", description: "4km recovery @ 7:15-7:45/km", targetDistance: 4, targetPace: "7:15-7:45" },

  // Week 6 (Apr 9-15) - Taper (~20 km)
  { date: "2026-04-09", weekNumber: 6, dayOfWeek: "Thu", type: "easy", title: "Easy Run", description: "5km @ 7:00-7:30/km", targetDistance: 5, targetPace: "7:00-7:30" },
  { date: "2026-04-10", weekNumber: 6, dayOfWeek: "Fri", type: "tempo", title: "Short Tempo", description: "WU 1km + 3km @ 5:55-6:00/km + CD 1km", targetDistance: 5, targetPace: "5:55-6:00" },
  { date: "2026-04-11", weekNumber: 6, dayOfWeek: "Sat", type: "rest", title: "Rest Day", description: "Full rest." },
  { date: "2026-04-12", weekNumber: 6, dayOfWeek: "Sun", type: "easy", title: "Easy + Strides", description: "5km easy + 4x100m strides. Stay sharp.", targetDistance: 6, targetPace: "7:00-7:30" },
  { date: "2026-04-13", weekNumber: 6, dayOfWeek: "Mon", type: "rest", title: "Rest", description: "Skip basketball this week if possible. Full rest." },
  { date: "2026-04-14", weekNumber: 6, dayOfWeek: "Tue", type: "easy", title: "Easy Run", description: "4km @ 7:00-7:20/km. Keep legs turning over.", targetDistance: 4, targetPace: "7:00-7:20" },
  { date: "2026-04-15", weekNumber: 6, dayOfWeek: "Wed", type: "rest", title: "Rest Day", description: "Full rest." },

  // Race Week (Apr 16-18)
  { date: "2026-04-16", weekNumber: 7, dayOfWeek: "Thu", type: "shakeout", title: "Shakeout Run", description: "3km very easy + 3x100m strides. Stay loose.", targetDistance: 3, targetPace: "7:30+" },
  { date: "2026-04-17", weekNumber: 7, dayOfWeek: "Fri", type: "rest", title: "Pre-Race Rest", description: "Full rest. Hydrate, carb up, sleep well. Lay out race gear tonight." },
  { date: "2026-04-18", weekNumber: 7, dayOfWeek: "Sat", type: "race", title: "RACE DAY - 10K", description: "Target splits: first km 6:05 (don't go out too fast), settle to 5:55-6:00 for km 2-8, push last 2km. You've done the work!", targetDistance: 10, targetPace: "6:00" },
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
