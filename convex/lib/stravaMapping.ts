const UPPER_BODY_KEYWORDS = /upper|arm|chest|back|shoulder|push|pull|bench/i;
const LOWER_BODY_KEYWORDS = /lower|leg|squat|glute|lunge|deadlift|calf/i;

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
  switch (type) {
    case "swim": return "Swim";
    case "upper_body": return "Upper Body";
    case "lower_body": return "Lower Body";
    case "cross_training": return "Cross Training";
    case "rest": return "Active Recovery";
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
