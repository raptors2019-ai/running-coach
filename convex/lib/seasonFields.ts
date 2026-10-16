import { v } from "convex/values";

/** A season's fields, shared by the schema and the createSeason mutation. */
export const seasonFields = {
  name: v.string(),
  startDate: v.string(), // a Monday
  endDate: v.string(), // a Sunday
  goals: v.array(v.object({
    label: v.string(),
    distanceKm: v.number(),
    targetSeconds: v.number(),
    byDate: v.string(),
  })),
  phases: v.array(v.object({
    key: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    focus: v.string(),
  })),
  checkpoints: v.array(v.object({
    date: v.string(),
    label: v.string(),
    distanceKm: v.number(),
    aimSeconds: v.optional(v.number()),
    isGoal: v.boolean(),
    resultSeconds: v.optional(v.number()),
  })),
};
