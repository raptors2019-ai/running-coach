"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vo2maxTrend } from "@/lib/vo2max";
import { Wind } from "lucide-react";

function formatDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Lab VO2max history — a years-long fitness record, not a training input. */
export function Vo2maxCard() {
  const tests = useQuery(api.vo2max.listTests);
  if (tests === undefined || tests.length === 0) return null;

  const trend = vo2maxTrend(tests);
  if (!trend) return null;
  const latest = tests[tests.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wind className="h-4 w-4 text-sky-600" />
          VO2max
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{latest.vo2max}</span>
          <span className="text-sm text-muted-foreground">ml/kg/min</span>
          {latest.percentile !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground">
              {latest.percentile}th percentile
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(latest.date)}
          {latest.lab && ` · ${latest.lab}`}
          {latest.maxHeartRate !== undefined && ` · max HR ${latest.maxHeartRate}`}
          {latest.weightLbs !== undefined && ` · ${latest.weightLbs} lb`}
        </p>

        {trend.change !== undefined && trend.previous && (
          <p className="text-sm">
            <span className={trend.change >= 0 ? "text-green-700" : "text-red-700"}>
              {signed(trend.change)}
            </span>{" "}
            since {formatDate(trend.previous.date)}
            {trend.changePerYear !== undefined && (
              <span className="text-muted-foreground"> ({signed(trend.changePerYear)}/yr)</span>
            )}
          </p>
        )}

        {latest.notes && <p className="text-xs text-muted-foreground">{latest.notes}</p>}

        {tests.length > 1 && (
          <ul className="border-t pt-2 space-y-1">
            {[...tests].reverse().map((t) => (
              <li key={t._id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{formatDate(t.date)}</span>
                <span className="tabular-nums font-medium">{t.vo2max}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
