"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { paceToSeconds, secondsToPace } from "@/lib/pace-utils";

export function PaceChart() {
  const workouts = useQuery(api.workouts.getCompletedWorkouts);

  if (!workouts || workouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Complete some workouts to see your pace trend
          </p>
        </CardContent>
      </Card>
    );
  }

  const runsWithPace = workouts
    .filter((w) => w.actualPace && w.type !== "rest" && w.type !== "basketball")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({
      date: format(parseISO(w.date), "MMM d"),
      paceSeconds: paceToSeconds(w.actualPace!),
      pace: w.actualPace!,
      type: w.type,
    }));

  if (runsWithPace.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Log run details to see your pace trend
          </p>
        </CardContent>
      </Card>
    );
  }

  const goalPaceSeconds = paceToSeconds("6:00");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pace Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={runsWithPace}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              domain={["dataMin - 30", "dataMax + 30"]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => secondsToPace(v)}
              reversed
            />
            <Tooltip
              formatter={(value) => [secondsToPace(value as number), "Pace"]}
              labelFormatter={(label) => label}
            />
            <ReferenceLine
              y={goalPaceSeconds}
              stroke="#8b5cf6"
              strokeDasharray="5 5"
              label={{ value: "Goal 6:00", position: "right", fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="paceSeconds"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
