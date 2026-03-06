"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getLocalDateString } from "@/lib/pace-utils";

export function WeeklyVolumeChart() {
  const workouts = useQuery(api.workouts.getAllWorkouts);

  if (!workouts) return null;

  const weeks = [1, 2, 3, 4, 5, 6, 7];
  const weekLabels = ["W1", "W2", "W3", "W4", "W5", "W6", "Race"];

  const data = weeks.map((week, i) => {
    const weekWorkouts = workouts.filter((w) => w.weekNumber === week);
    const planned = weekWorkouts.reduce(
      (sum, w) => sum + (w.targetDistance || 0),
      0
    );
    const actual = weekWorkouts
      .filter((w) => w.completed)
      .reduce((sum, w) => sum + (w.actualDistance || w.targetDistance || 0), 0);

    return {
      week: weekLabels[i],
      planned,
      actual,
    };
  });

  const currentWeek = (() => {
    const today = getLocalDateString();
    const currentWorkout = workouts.find((w) => w.date === today);
    return currentWorkout?.weekNumber || 1;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly Volume (km)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value, name) => [
                `${value} km`,
                name === "planned" ? "Planned" : "Actual",
              ]}
            />
            <Bar dataKey="planned" radius={[4, 4, 0, 0]} opacity={0.3}>
              {data.map((_, i) => (
                <Cell key={i} fill="#94a3b8" />
              ))}
            </Bar>
            <Bar dataKey="actual" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={i + 1 === currentWeek ? "#3b82f6" : "#22c55e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
