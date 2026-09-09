import { format, parseISO } from "date-fns";

type Row = {
  _id: string;
  date: string;
  title: string;
  completed: boolean;
  isUnplanned?: boolean;
};

/**
 * What the athlete could have done "instead": the week's other planned
 * workouts that are still open, soonest first. Completed days are history
 * and unplanned rows are Strava imports, so neither is a plan to swap in.
 */
export function substitutionOptions<T extends Row>(weekWorkouts: T[], current: Pick<Row, "_id">): T[] {
  return weekWorkouts
    .filter((w) => w._id !== current._id && !w.completed && !w.isUnplanned)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The chat message that hands the substitution to the coach to rebalance. */
export function substitutionMessage(args: { date: string; did: string; insteadOf: string }): string {
  const day = format(parseISO(args.date), "EEE MMM d");
  return `I did ${args.did} on ${day} instead of ${args.insteadOf}. Rebalance the rest of the week and tell me what you changed.`;
}

/**
 * The title as it was planned. A Strava sync that found a different kind of
 * activity relabels the row and leaves the plan in its note, so read it back
 * from there.
 */
export function plannedTitle(w: { title: string; originalType?: string; notes?: string }): string {
  if (!w.originalType) return w.title;
  const m = w.notes?.match(/Originally planned: (.+?)\. Did:/);
  return m?.[1] ?? w.title;
}
