import { v, type Infer } from "convex/values";

/**
 * A week's run slots in season mode. A slot is a session with no day: the
 * week asks for "a quality run, a long run, maybe an easy one", and whichever
 * runs happen that week fill them (see slotMatching).
 */
export const slotKindValidator = v.union(v.literal("quality"), v.literal("long"), v.literal("easy"));

export const intervalValidator = v.object({
  distance: v.string(),
  pace: v.string(),
  rest: v.string(),
  reps: v.number(),
});

export const slotValidator = v.object({
  id: v.string(), // stable within the week, e.g. "q1"
  kind: slotKindValidator,
  type: v.string(), // workout type for colours: intervals, tempo, long, easy…
  title: v.string(),
  description: v.string(),
  targetDistance: v.optional(v.number()), // km
  targetPace: v.optional(v.string()),
  intervals: v.optional(v.array(intervalValidator)),
  optional: v.boolean(),
  // A run assigned by hand (or by the coach). Kept as a string so pure code
  // and tests can use it; it holds a workouts Id.
  pinnedWorkoutId: v.optional(v.string()),
  skipped: v.optional(v.boolean()),
});

export type Slot = Infer<typeof slotValidator>;
export type SlotKind = Infer<typeof slotKindValidator>;
