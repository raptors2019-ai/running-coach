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
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { format } from "date-fns";
import { paceToSeconds, secondsToPace } from "@/lib/pace-utils";
import { GOAL_PACE, PACE_ZONES } from "@/lib/constants";
import { buildPaceSeries } from "@/lib/progress";

const SERIES_LABELS: Record<string, string> = {
  hardSeconds: "Hard effort",
  easySeconds: "Easy run",
};

export function PaceChart() {
  const workouts = useQuery(api.workouts.getCompletedWorkouts);

  if (workouts === undefined) return null;

  const series = buildPaceSeries(workouts);

  if (series.length === 0) {
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

  const goalPaceSeconds = paceToSeconds(GOAL_PACE);
  const easyZone = PACE_ZONES.find((z) => z.name === "Easy");
  const allSeconds = series.flatMap((p) => [p.hardSeconds, p.easySeconds]).filter(
    (s): s is number => s !== undefined
  );
  const yMin = Math.min(goalPaceSeconds, ...allSeconds) - 20;
  const yMax = Math.max(...allSeconds) + 20;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pace Trend</CardTitle>
        <p className="text-xs text-muted-foreground">
          Hard efforts are what should trend toward the goal line. Easy runs belong in the
          green band.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(ts: number) => format(ts, "MMM d")}
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => secondsToPace(v)}
              width={44}
              reversed
            />
            <Tooltip
              labelFormatter={(ts) => format(Number(ts), "EEE MMM d")}
              formatter={(value, name) => [
                `${secondsToPace(Number(value))}/km`,
                SERIES_LABELS[String(name)] ?? String(name),
              ]}
            />
            <Legend
              formatter={(value: string) => SERIES_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 12 }}
            />
            {easyZone && (
              <ReferenceArea
                y1={paceToSeconds(easyZone.minPace)}
                y2={paceToSeconds(easyZone.maxPace)}
                fill="#22c55e"
                fillOpacity={0.08}
              />
            )}
            <ReferenceLine
              y={goalPaceSeconds}
              stroke="#8b5cf6"
              strokeDasharray="5 5"
              label={{ value: `Goal ${GOAL_PACE}`, position: "insideTopRight", fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="easySeconds"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="hardSeconds"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: "#f97316", r: 5 }}
              activeDot={{ r: 7 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
