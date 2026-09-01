import { addDays, format, parseISO, startOfWeek } from "date-fns";

export interface WeekBounds {
  start: string; // Monday, YYYY-MM-DD
  end: string; // Sunday, YYYY-MM-DD
}

/** Monday–Sunday bounds of the week containing `date`, matching plan weeks. */
export function getWeekBounds(date: string): WeekBounds {
  const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return {
    start: format(monday, "yyyy-MM-dd"),
    end: format(addDays(monday, 6), "yyyy-MM-dd"),
  };
}

export interface WeeklyStats {
  completedCount: number;
  totalCount: number;
  completedKm: number;
  plannedKm: number;
}

export function getWeeklyStats(
  workouts: Array<{ date: string; completed: boolean; targetDistance?: number; actualDistance?: number }>,
  today: string
): WeeklyStats {
  const { start, end } = getWeekBounds(today);
  const thisWeek = workouts.filter((w) => w.date >= start && w.date <= end);
  const completed = thisWeek.filter((w) => w.completed);
  const plannedKm = thisWeek.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
  const completedKm = completed.reduce((sum, w) => sum + (w.actualDistance || w.targetDistance || 0), 0);

  return {
    completedCount: completed.length,
    totalCount: thisWeek.length,
    completedKm,
    plannedKm,
  };
}
