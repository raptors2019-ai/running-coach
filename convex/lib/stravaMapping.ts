const UPPER_BODY_KEYWORDS = /upper|arm|chest|back|shoulder|push|pull|bench/i;
const LOWER_BODY_KEYWORDS = /lower|leg|squat|glute|lunge|deadlift|calf/i;

const RUNNING_TYPES = new Set([
  "easy", "long", "tempo", "intervals", "race_pace", "recovery", "race", "shakeout", "run",
]);

export function isRunningType(type: string): boolean {
  return RUNNING_TYPES.has(type);
}

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  easy: "Easy",
  tempo: "Tempo",
  intervals: "Intervals",
  long: "Long Run",
  rest: "Active Recovery",
  cross_training: "Cross Training",
  upper_body: "Upper Body",
  lower_body: "Lower Body",
  swim: "Swim",
  race: "Race Day",
  shakeout: "Shakeout",
  race_pace: "Race Pace",
};

export function mapStravaTypeToWorkoutType(
  stravaType: string,
  activityName: string
): string {
  switch (stravaType) {
    case "Run":
    case "TrailRun":
    case "VirtualRun":
      return "run";
    case "Swim":
      return "swim";
    case "WeightTraining":
      if (UPPER_BODY_KEYWORDS.test(activityName)) return "upper_body";
      if (LOWER_BODY_KEYWORDS.test(activityName)) return "lower_body";
      return "cross_training";
    case "Walk":
      return "rest";
    case "Ride":
    case "VirtualRide":
    case "Hike":
    case "Yoga":
    case "Crossfit":
    case "Workout":
    case "Elliptical":
    case "StairStepper":
    case "Rowing":
    default:
      return "cross_training";
  }
}

export function workoutTitleForType(type: string): string {
  return WORKOUT_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatPaceWithUnit(distanceKm: number, durationSeconds: number): string {
  if (distanceKm <= 0) return "0:00/km";
  const paceSeconds = durationSeconds / distanceKm;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}
