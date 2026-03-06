"use client";

import { useQuery } from "convex/react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { getLocalDateString } from "@/lib/pace-utils";

function getWeatherWarnings(weather: {
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  precipitation: number;
  condition: string;
}) {
  const warnings: { type: string; message: string }[] = [];
  if (weather.feelsLike < -5) warnings.push({ type: "cold", message: `Feels like ${weather.feelsLike}C - dress warm, cover extremities` });
  if (weather.feelsLike > 28) warnings.push({ type: "hot", message: `Feels like ${weather.feelsLike}C - hydrate extra, run early/late` });
  if (weather.precipitation > 0 || weather.condition === "Rain") warnings.push({ type: "rain", message: "Rain expected - wear a light shell" });
  if (weather.condition === "Snow" || weather.condition === "Ice") warnings.push({ type: "ice", message: "Icy conditions - consider treadmill or skip" });
  if (weather.windSpeed > 30) warnings.push({ type: "wind", message: `Wind ${weather.windSpeed}km/h - start into the wind, finish with it` });
  return warnings;
}

export function WeatherWidget() {
  const today = getLocalDateString();
  const weather = useQuery(api.weather.getCachedWeather, { date: today });
  const fetchWeather = useAction(api.weather.fetchWeather);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (weather === null && !hasFetched.current) {
      hasFetched.current = true;
      fetchWeather().catch((err) => {
        console.error("Failed to fetch weather:", err);
      });
    }
  }, [weather, fetchWeather]);

  if (!weather) {
    return (
      <Card className="bg-gradient-to-br from-sky-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Cloud className="h-4 w-4" />
            <span>Weather data loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const warnings = getWeatherWarnings(weather);

  return (
    <Card className="bg-gradient-to-br from-sky-50 to-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold">{weather.temperature}°C</div>
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                Feels {weather.feelsLike}°C
              </div>
              <div>{weather.condition}</div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-1">
              <Droplets className="h-3 w-3" />
              {weather.humidity}%
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-3 w-3" />
              {weather.windSpeed} km/h
            </div>
          </div>
        </div>
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {w.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
