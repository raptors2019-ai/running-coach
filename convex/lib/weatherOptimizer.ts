export interface DayForecast {
  date: string;
  conditionAm: string;
  conditionPm: string;
  temperatureAm: number;
  temperaturePm: number;
  precipitationAm: number;
  precipitationPm: number;
  windSpeedAm: number;
  windSpeedPm: number;
}

export interface WorkoutSlot {
  id: string;
  date: string;
  type: string;
  title: string;
  completed: boolean;
  weekNumber: number;
  targetDistance?: number;
  isUnplanned?: boolean;
}

export interface SwapProposal {
  workout1Id: string;
  workout1Date: string;
  workout1Type: string;
  workout1Title: string;
  workout2Id: string;
  workout2Date: string;
  workout2Type: string;
  workout2Title: string;
}

export interface OptimizationResult {
  proposals: SwapProposal[];
  forecast: DayForecast[];
  currentSchedule: WorkoutSlot[];
  proposedSchedule: WorkoutSlot[];
}

const RAIN_CONDITIONS = ["Rain", "Drizzle", "Thunderstorm"];
const SEVERE_CONDITIONS = ["Thunderstorm", "Snow", "Ice"];

export function scoreOutdoorSuitability(day: DayForecast): number {
  let score = 80;

  for (const window of ["Am", "Pm"] as const) {
    const condition = day[`condition${window}`];
    const precip = day[`precipitation${window}`];
    const wind = day[`windSpeed${window}`];
    const temp = day[`temperature${window}`];

    if (SEVERE_CONDITIONS.includes(condition)) score -= 40;
    else if (RAIN_CONDITIONS.includes(condition)) score -= 25;
    else if (condition === "Clouds") score += 5;
    else if (condition === "Clear") score += 10;

    if (precip > 5) score -= 20;
    else if (precip > 2) score -= 10;

    if (wind > 40) score -= 20;
    else if (wind > 30) score -= 10;

    if (temp < -15) score -= 25;
    else if (temp < -5) score -= 10;
    if (temp > 30) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function classifyWorkout(
  type: string
): "outdoor" | "indoor" | "fixed" {
  const outdoor = new Set([
    "easy",
    "long",
    "tempo",
    "intervals",
    "race_pace",
    "recovery",
  ]);
  const indoor = new Set([
    "upper_body",
    "lower_body",
    "swim",
    "cross_training",
  ]);
  const fixed = new Set(["race", "shakeout", "rest"]);

  if (fixed.has(type)) return "fixed";
  if (indoor.has(type)) return "indoor";
  if (outdoor.has(type)) return "outdoor";
  return "fixed"; // unknown types don't move
}

export function optimizeSchedule(
  workouts: WorkoutSlot[],
  forecast: DayForecast[]
): OptimizationResult {
  // Only work with planned, uncompleted, movable workouts (skip unplanned Strava extras)
  const movable = workouts.filter(
    (w) => !w.completed && !w.isUnplanned && classifyWorkout(w.type) !== "fixed"
  );

  if (movable.length < 2) {
    return {
      proposals: [],
      forecast,
      currentSchedule: workouts,
      proposedSchedule: workouts,
    };
  }

  // Score each date
  const forecastMap = new Map(forecast.map((f) => [f.date, f]));
  const dateScores = new Map<string, number>();
  for (const w of movable) {
    const f = forecastMap.get(w.date);
    dateScores.set(w.date, f ? scoreOutdoorSuitability(f) : 50);
  }

  // Group movable workouts by weekNumber to respect same-week constraint
  const weekGroups = new Map<number, WorkoutSlot[]>();
  for (const w of movable) {
    const group = weekGroups.get(w.weekNumber) || [];
    group.push(w);
    weekGroups.set(w.weekNumber, group);
  }

  const proposals: SwapProposal[] = [];

  for (const [, weekWorkouts] of weekGroups) {
    if (weekWorkouts.length < 2) continue;

    const outdoor = weekWorkouts
      .filter((w) => classifyWorkout(w.type) === "outdoor")
      .sort((a, b) => (b.targetDistance ?? 0) - (a.targetDistance ?? 0));
    const indoor = weekWorkouts.filter(
      (w) => classifyWorkout(w.type) === "indoor"
    );

    // Get unique dates in this week group sorted by outdoor score
    const dates = [...new Set(weekWorkouts.map((w) => w.date))];
    const sortedByBest = [...dates].sort(
      (a, b) => (dateScores.get(b) ?? 50) - (dateScores.get(a) ?? 50)
    );

    // Build optimal assignment: outdoor workouts → best days, indoor → worst days
    const assignment = new Map<string, WorkoutSlot>();
    const usedDates = new Set<string>();
    const usedWorkouts = new Set<string>();

    // Assign outdoor workouts to best-weather days
    for (const w of outdoor) {
      const bestDate = sortedByBest.find(
        (d) => !usedDates.has(d)
      );
      if (bestDate) {
        assignment.set(bestDate, w);
        usedDates.add(bestDate);
        usedWorkouts.add(w.id);
      }
    }

    // Assign indoor workouts to remaining dates (worst weather first)
    const sortedByWorst = [...dates].sort(
      (a, b) => (dateScores.get(a) ?? 50) - (dateScores.get(b) ?? 50)
    );
    for (const w of indoor) {
      const worstDate = sortedByWorst.find(
        (d) => !usedDates.has(d)
      );
      if (worstDate) {
        assignment.set(worstDate, w);
        usedDates.add(worstDate);
        usedWorkouts.add(w.id);
      }
    }

    // Any unassigned workouts stay put
    for (const w of weekWorkouts) {
      if (!usedWorkouts.has(w.id) && !usedDates.has(w.date)) {
        assignment.set(w.date, w);
        usedDates.add(w.date);
      }
    }

    // Build a map of date → the single planned workout currently on that date
    // (only for dates that appear in assignment, to match 1:1)
    const currentByDate = new Map<string, WorkoutSlot>();
    for (const w of weekWorkouts) {
      if (!currentByDate.has(w.date)) {
        currentByDate.set(w.date, w);
      }
    }

    // Track which swaps we've already proposed (bidirectional)
    const swapped = new Set<string>();

    for (const [date, proposedWorkout] of assignment) {
      const currentWorkout = currentByDate.get(date);
      if (!currentWorkout || currentWorkout.id === proposedWorkout.id) continue;
      if (swapped.has(currentWorkout.id) || swapped.has(proposedWorkout.id))
        continue;

      proposals.push({
        workout1Id: currentWorkout.id,
        workout1Date: currentWorkout.date,
        workout1Type: currentWorkout.type,
        workout1Title: currentWorkout.title,
        workout2Id: proposedWorkout.id,
        workout2Date: proposedWorkout.date,
        workout2Type: proposedWorkout.type,
        workout2Title: proposedWorkout.title,
      });

      swapped.add(currentWorkout.id);
      swapped.add(proposedWorkout.id);
    }
  }

  // Build proposed schedule
  const proposedSchedule = workouts.map((w) => {
    for (const p of proposals) {
      if (w.id === p.workout1Id)
        return { ...w, date: p.workout2Date };
      if (w.id === p.workout2Id)
        return { ...w, date: p.workout1Date };
    }
    return w;
  });

  return {
    proposals,
    forecast,
    currentSchedule: workouts,
    proposedSchedule,
  };
}
