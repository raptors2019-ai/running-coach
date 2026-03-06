import { PaceZone } from "./types";

export const RACE_DATE = "2026-04-18";
export const PLAN_START_DATE = "2026-03-05";
export const RACE_DISTANCE_KM = 10;
export const GOAL_TIME_MINUTES = 60;
export const GOAL_PACE = "6:00"; // min/km
export const CURRENT_PACE = "7:25"; // min/km (relaxed)

export const MISSISSAUGA_COORDS = {
  lat: 43.589,
  lon: -79.644,
};

export const PACE_ZONES: PaceZone[] = [
  { name: "Easy", minPace: "7:00", maxPace: "7:30", color: "bg-green-500" },
  { name: "Long Run", minPace: "6:30", maxPace: "7:15", color: "bg-blue-500" },
  { name: "Tempo", minPace: "5:50", maxPace: "6:10", color: "bg-yellow-500" },
  { name: "Interval", minPace: "5:15", maxPace: "5:40", color: "bg-red-500" },
  { name: "Recovery", minPace: "7:15", maxPace: "7:45", color: "bg-emerald-400" },
];

export const WORKOUT_TYPE_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800 border-green-200",
  tempo: "bg-yellow-100 text-yellow-800 border-yellow-200",
  intervals: "bg-red-100 text-red-800 border-red-200",
  long: "bg-blue-100 text-blue-800 border-blue-200",
  rest: "bg-gray-100 text-gray-600 border-gray-200",
  cross_training: "bg-orange-100 text-orange-800 border-orange-200",
  upper_body: "bg-indigo-100 text-indigo-800 border-indigo-200",
  lower_body: "bg-pink-100 text-pink-800 border-pink-200",
  swim: "bg-cyan-100 text-cyan-800 border-cyan-200",
  race: "bg-purple-100 text-purple-800 border-purple-200",
  shakeout: "bg-teal-100 text-teal-800 border-teal-200",
  race_pace: "bg-amber-100 text-amber-800 border-amber-200",
};

export const WORKOUT_TYPE_LABELS: Record<string, string> = {
  easy: "Easy",
  tempo: "Tempo",
  intervals: "Intervals",
  long: "Long Run",
  rest: "Rest",
  cross_training: "Cross-Train",
  upper_body: "Upper Body",
  lower_body: "Lower Body",
  swim: "Swim",
  race: "Race Day",
  shakeout: "Shakeout",
  race_pace: "Race Pace",
};

const NON_RUNNING_TYPES = new Set(["rest", "cross_training", "upper_body", "lower_body", "swim"]);

export function isNonRunningType(type: string): boolean {
  return NON_RUNNING_TYPES.has(type);
}

export const RUNNING_TYPES = new Set(["easy", "tempo", "intervals", "long", "race", "shakeout", "race_pace"]);

export const MIN_RUNS_PER_WEEK: Record<number, number> = {
  1: 4,
  2: 5,
  3: 4,
  4: 4,
  5: 5,
  6: 4,
  7: 2,
};
