import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  trainingPlan: defineTable({
    name: v.string(),
    startDate: v.string(),
    raceDate: v.string(),
    goalTime: v.number(), // seconds
    currentPace: v.string(),
    goalPace: v.string(),
  }),

  workouts: defineTable({
    planId: v.id("trainingPlan"),
    date: v.string(), // YYYY-MM-DD
    weekNumber: v.number(),
    dayOfWeek: v.string(),
    type: v.string(),
    title: v.string(),
    description: v.string(),
    targetDistance: v.optional(v.number()), // km
    targetPace: v.optional(v.string()),
    intervals: v.optional(
      v.array(
        v.object({
          distance: v.string(),
          pace: v.string(),
          rest: v.string(),
          reps: v.number(),
        })
      )
    ),
    completed: v.boolean(),
    actualDistance: v.optional(v.number()),
    actualDuration: v.optional(v.number()), // seconds
    actualPace: v.optional(v.string()),
    avgHeartRate: v.optional(v.number()),
    notes: v.optional(v.string()),
    stravaActivityId: v.optional(v.string()),
    originalType: v.optional(v.string()),
    isUnplanned: v.optional(v.boolean()),
  }).index("by_date", ["date"])
    .index("by_plan", ["planId"])
    .index("by_week", ["planId", "weekNumber"]),

  journalEntries: defineTable({
    workoutId: v.optional(v.id("workouts")),
    date: v.string(),
    autoFeedback: v.string(),
    userNotes: v.optional(v.string()),
    mood: v.optional(v.union(
      v.literal("great"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("tired"),
      v.literal("bad")
    )),
    coachFeedbackUnlocked: v.optional(v.boolean()),
  }).index("by_date", ["date"])
    .index("by_workout", ["workoutId"]),

  stravaAuth: defineTable({
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    athleteId: v.string(),
    lastSyncAt: v.optional(v.number()),
  }),

  weatherCache: defineTable({
    date: v.string(),
    temperature: v.number(),
    feelsLike: v.number(),
    humidity: v.number(),
    windSpeed: v.number(),
    condition: v.string(),
    icon: v.string(),
    precipitation: v.number(),
    fetchedAt: v.number(),
  }).index("by_date", ["date"]),
});
