import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAllEntries = query({
  handler: async (ctx) => {
    const entries = await ctx.db.query("journalEntries").collect();
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const workout = entry.workoutId ? await ctx.db.get(entry.workoutId) : null;
        return { ...entry, workout };
      })
    );
    return enriched.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const getEntryByWorkout = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.workoutId))
      .first();
  },
});

function generateAutoFeedback(
  workout: {
    type: string;
    title: string;
    targetDistance?: number;
    actualDistance?: number;
    targetPace?: string;
    actualPace?: string;
  },
  nextWorkout: { title: string; type: string } | null,
  weekCompletedCount: number,
  weekTotalCount: number
): string {
  const parts: string[] = [];

  parts.push(`Good job on your ${workout.title}.`);

  if (workout.targetPace && workout.actualPace) {
    const targetMin = parsePaceMin(workout.targetPace);
    const actualMin = parsePaceMin(workout.actualPace);
    if (targetMin && actualMin) {
      if (actualMin <= targetMin) {
        parts.push("Hit your target pace!");
      } else if (actualMin - targetMin < 0.25) {
        parts.push("Close to target pace - keep at it.");
      } else {
        parts.push("Pace was off target - consistency matters more than speed.");
      }
    }
  }

  if (workout.targetDistance && workout.actualDistance) {
    if (workout.actualDistance < workout.targetDistance * 0.95) {
      parts.push(
        `Covered ${workout.actualDistance.toFixed(1)} of ${workout.targetDistance.toFixed(1)} km.`
      );
    }
  }

  if (nextWorkout) {
    if (nextWorkout.type === "rest") {
      parts.push("Rest day tomorrow - enjoy recovery.");
    } else {
      parts.push(`Tomorrow: ${nextWorkout.title} - rest up.`);
    }
  }

  const pct = weekTotalCount > 0 ? weekCompletedCount / weekTotalCount : 0;
  if (pct > 0.8) {
    parts.push("Strong week so far!");
  }

  if (["intervals", "tempo", "race_pace", "long"].includes(workout.type)) {
    parts.push("Don't skip stretching after intense sessions.");
  }

  return parts.join(" ");
}

function parsePaceMin(pace: string): number | null {
  const clean = pace.split("-")[0].replace("/km", "").trim();
  const parts = clean.split(":");
  if (parts.length !== 2) return null;
  return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

export const generateMissingEntries = mutation({
  handler: async (ctx) => {
    const allWorkouts = await ctx.db.query("workouts").collect();
    const completedWorkouts = allWorkouts.filter((w) => w.completed);

    let created = 0;
    for (const workout of completedWorkouts) {
      const existing = await ctx.db
        .query("journalEntries")
        .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
        .first();
      if (existing) continue;

      // Find next workout by date
      const nextWorkout = allWorkouts
        .filter((w) => w.date > workout.date)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

      // Count completed in same week
      const sameWeek = allWorkouts.filter((w) => w.weekNumber === workout.weekNumber);
      const weekCompleted = sameWeek.filter((w) => w.completed).length;

      const autoFeedback = generateAutoFeedback(
        workout,
        nextWorkout,
        weekCompleted,
        sameWeek.length
      );

      await ctx.db.insert("journalEntries", {
        workoutId: workout._id,
        date: workout.date,
        autoFeedback,
      });
      created++;
    }

    return created;
  },
});

export const updateUserNotes = mutation({
  args: {
    entryId: v.id("journalEntries"),
    userNotes: v.optional(v.string()),
    mood: v.optional(
      v.union(
        v.literal("great"),
        v.literal("good"),
        v.literal("okay"),
        v.literal("tired"),
        v.literal("bad")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { entryId, ...data } = args;
    const patch: Record<string, unknown> = { ...data };
    if (args.userNotes && args.userNotes.trim()) {
      patch.coachFeedbackUnlocked = true;
    }
    await ctx.db.patch(entryId, patch);
  },
});

export const getTodayJournalStatus = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("journalEntries")
      .withIndex("by_date", (q) => q.eq("date", args.today))
      .first();

    if (!entry) {
      return { hasEntry: false, hasNotes: false, coachFeedbackUnlocked: false };
    }

    return {
      hasEntry: true,
      hasNotes: !!(entry.userNotes?.trim()),
      coachFeedbackUnlocked: entry.coachFeedbackUnlocked ?? false,
    };
  },
});
