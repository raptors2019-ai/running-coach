export type WorkoutType =
  | "easy"
  | "tempo"
  | "intervals"
  | "long"
  | "rest"
  | "cross_training"
  | "upper_body"
  | "lower_body"
  | "swim"
  | "race"
  | "shakeout"
  | "race_pace";

export interface Interval {
  distance: string;
  pace: string;
  rest: string;
  reps: number;
}

export interface PaceZone {
  name: string;
  minPace: string;
  maxPace: string;
  color: string;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  icon: string;
  precipitation: number;
}

export interface WeatherWarning {
  type: "cold" | "rain" | "ice" | "wind" | "hot";
  message: string;
}
