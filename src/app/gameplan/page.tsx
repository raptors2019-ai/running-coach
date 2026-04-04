"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil } from "@/lib/pace-utils";
import { RACE_DATE, GOAL_PACE, CURRENT_PACE } from "@/lib/constants";
import { ArrowLeft, Target, Heart, Zap, Trophy, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const PHASES = [
  {
    number: 1,
    dates: "Apr 3 - 6",
    theme: "Reintroduce Running",
    volume: "~27 km",
    color: "border-green-400",
    headerBg: "bg-green-50",
    zone2: ["Easy run (10-12 km) at 7:00-7:30/km", "Long run (10-12 km) at 6:45-7:15/km", "Easy + strides (5 km)"],
    zone5: ["4x100m strides after easy run"],
    lifts: ["Upper body (Sat AM)", "Lower body (Mon)"],
    purpose:
      "Get your legs used to running again after cross-training. Your cardio is there from swimming - now your legs need to catch up. Don't overdo it.",
    keyPoint:
      "Go genuinely easy on all runs. Your cardiovascular fitness is ahead of your running-specific fitness right now. Let your legs adapt.",
  },
  {
    number: 2,
    dates: "Apr 7 - 10",
    theme: "Race Pace Test + Sharpening",
    volume: "~20 km",
    color: "border-amber-400",
    headerBg: "bg-amber-50",
    zone2: ["Recovery run (4 km) after race pace test"],
    zone5: ["RACE PACE TEST: 5km @ 6:00/km - the key workout", "Tempo intervals: 4x1km @ 5:50-6:00/km"],
    lifts: ["Upper body (Wed)", "Lower body (Fri) - last hard leg day"],
    purpose:
      "The race pace test on Apr 7 tells you everything. If you can hold 6:00/km for 5km, sub-60 is real. The tempo intervals sharpen your ability to hold pace under fatigue.",
    keyPoint:
      "The Apr 7 test is everything. Lock in 6:00/km - don't start at 5:45. If it feels controlled but hard, you're ready. If you can't hold it past 3km, adjust to a 61-62 min target.",
  },
  {
    number: 3,
    dates: "Apr 11 - 18",
    theme: "Cottage + Taper + Race",
    volume: "~15 km + Race",
    color: "border-purple-600",
    headerBg: "bg-gradient-to-r from-purple-50 to-pink-50",
    zone2: ["Easy + strides (5 km Mon, 4 km Wed)", "Shakeout (3 km Fri)", "Swim/bike on rest days - zero impact, keeps cardio up"],
    zone5: ["RACE DAY - April 18!"],
    lifts: ["None - fresh legs only"],
    purpose:
      "Cottage weekend swim/bike keeps blood flowing without leg stress. Then short easy runs to stay sharp. Swimming and easy biking are perfect taper activities - zero impact, maintains cardio.",
    keyPoint:
      "You might feel restless or sluggish during the taper - that's normal. Swim or bike to scratch the itch. Skip all lifting this phase. Trust the process.",
  },
];

function PhaseCard({ phase }: { phase: (typeof PHASES)[number] }) {
  const [open, setOpen] = useState(true);

  return (
    <Card className={`border-l-4 ${phase.color}`}>
      <button
        className={`w-full text-left ${phase.headerBg} rounded-t-lg`}
        onClick={() => setOpen(!open)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Phase {phase.number} - {phase.theme}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {phase.dates} | {phase.volume}
              </p>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm">{phase.purpose}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-green-800 mb-2">
                <Heart className="h-3.5 w-3.5" />
                Zone 2 (Aerobic)
              </div>
              <ul className="space-y-1">
                {phase.zone2.map((item, i) => (
                  <li key={i} className="text-sm text-green-900/80 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-green-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-800 mb-2">
                <Zap className="h-3.5 w-3.5" />
                Zone 5 (Speed/VO2max)
              </div>
              <ul className="space-y-1">
                {phase.zone5.map((item, i) => (
                  <li key={i} className="text-sm text-red-900/80 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-800 mb-2">
                <Target className="h-3.5 w-3.5" />
                Lifting
              </div>
              <ul className="space-y-1">
                {phase.lifts.map((item, i) => (
                  <li key={i} className="text-sm text-indigo-900/80 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-indigo-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-sm text-amber-900">
              <span className="font-medium">Key point:</span> {phase.keyPoint}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function GamePlanPage() {
  const daysLeft = daysUntil(RACE_DATE);

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
      {/* Back nav */}
      <Link
        href="/plan"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Plan
      </Link>

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-1">Game Plan</h1>
        <p className="text-blue-100 text-sm mb-4">Revised 15-Day Plan - Mississauga 10K - April 18, 2026</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{CURRENT_PACE}</div>
            <div className="text-xs text-blue-200">Current Pace</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{GOAL_PACE}</div>
            <div className="text-xs text-blue-200">Target Pace</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{daysLeft}</div>
            <div className="text-xs text-blue-200">Days Left</div>
          </div>
        </div>
      </div>

      {/* Training Philosophy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Training Philosophy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            This is a <span className="font-semibold">15-day crash course</span> - not a full
            training block. Your cardiovascular fitness from swimming and cross-training is intact.
            The plan focuses on three things:
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
                <Heart className="h-4 w-4" />
                Reintroduce Running
              </div>
              <p className="text-sm text-green-900/80">
                Get your legs back under you with easy volume. Your cardio is ahead of your
                running-specific fitness - let your legs catch up safely.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                <Zap className="h-4 w-4" />
                Test Race Pace
              </div>
              <p className="text-sm text-red-900/80">
                The Apr 7 race pace test is the key workout. 5km at 6:00/km tells you if sub-60
                is realistic. Tempo intervals sharpen your ability to hold pace under fatigue.
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-indigo-800 mb-2">
                <Target className="h-4 w-4" />
                Lifting + Taper
              </div>
              <p className="text-sm text-indigo-900/80">
                Front-load 4 lifting sessions (2 upper, 2 lower) in the first 8 days.
                No lifting after Apr 10 - fresh legs for race week.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            The cottage weekend (Apr 11-12) acts as a natural mini-deload before race week.
            Trust the taper - you might feel sluggish, but your body is storing energy.
          </p>
        </CardContent>
      </Card>

      {/* Phase by Phase */}
      <div>
        <h2 className="text-lg font-bold mb-3">Phase-by-Phase Breakdown</h2>
        <div className="space-y-4">
          {PHASES.map((phase) => (
            <PhaseCard key={phase.number} phase={phase} />
          ))}
        </div>
      </div>

      {/* Race Strategy */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            Race Day Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
              <div className="bg-purple-100 text-purple-700 font-bold text-sm rounded-full h-7 w-7 flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <p className="text-sm font-medium">KM 1-2: Conservative Start</p>
                <p className="text-xs text-muted-foreground">
                  Run 6:10/km. Resist the urge to go out fast with the crowd. Settle in and find
                  your breathing rhythm.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
              <div className="bg-purple-100 text-purple-700 font-bold text-sm rounded-full h-7 w-7 flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="text-sm font-medium">KM 3-7: Settle Into Goal Pace</p>
                <p className="text-xs text-muted-foreground">
                  Lock into 6:00/km. This is your cruise pace. Stay relaxed, focus on form, and
                  let the kilometres tick by.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
              <div className="bg-purple-100 text-purple-700 font-bold text-sm rounded-full h-7 w-7 flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="text-sm font-medium">KM 8-10: Push If You Can</p>
                <p className="text-xs text-muted-foreground">
                  If you feel good at KM 7, gradually pick it up to 5:50/km. The finish line is
                  close - empty the tank over the last kilometre.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Target splits: 12:20 (2K) → 30:00 (5K) → 42:00 (7K) → 59:00 (finish)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
