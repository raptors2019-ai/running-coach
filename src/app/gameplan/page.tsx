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
    dates: "Aug 25 - 31",
    theme: "Rebuild + Benchmark",
    volume: "~14 km",
    color: "border-green-400",
    headerBg: "bg-green-50",
    zone2: ["Easy run + strides (4 km Tue)", "Partner easy run (2-3 km Sat)", "Zone 2 run (5 km Sun)"],
    zone5: ["BENCHMARK: 2K time trial (Thu) - calibrates the whole plan"],
    lifts: ["Upper body (Wed)", "Lower body (Fri)"],
    purpose:
      "You've been cruising short 2ks at 7:00+/km - the base is there, the speed is dormant. The Thursday 2K time trial tells us exactly where you are and whether 24:30 or sub-25 is the target.",
    keyPoint:
      "Under 9:50 on the 2K → chase 24:30. 9:50-10:30 → sub-25 is the goal. Over 10:30 → we build and retest in week 3. No wrong answer, just data.",
  },
  {
    number: 2,
    dates: "Sep 1 - 13",
    theme: "Speed Development",
    volume: "~39 km",
    color: "border-red-400",
    headerBg: "bg-red-50",
    zone2: ["Zone 2 runs (5 km Thu)", "Partner easy runs (2-3 km Sat)", "Long runs building 6 → 7 km (Sun)"],
    zone5: ["8x400m @ 4:45-4:55/km (Tue Sep 1)", "VO2max: 5x800m @ 4:50-5:00/km (Tue Sep 8)"],
    lifts: ["Upper body (Mon)", "Lower body (Wed, day after speed)"],
    purpose:
      "Two weeks of pure speed - short reps first, then double the rep length at nearly the same pace. This is what moves you from 5:18/km fitness to 5:00/km fitness. The Sunday long runs quietly build the floor underneath.",
    keyPoint:
      "Hit the interval paces, don't beat them. Going 4:30 on rep one and dying by rep five trains nothing. Even splits win.",
  },
  {
    number: 3,
    dates: "Sep 14 - 27",
    theme: "Race Pace + Sharpen",
    volume: "~37 km",
    color: "border-amber-400",
    headerBg: "bg-amber-50",
    zone2: ["Zone 2 runs (5-6 km Thu)", "Partner easy runs (Sat)", "Long run 7 km (Sep 20), easy 5 km (Sep 27)"],
    zone5: ["RACE PACE TEST: 3km @ 5:00/km (Tue Sep 15) - the key workout", "The April Special: 4x1km @ 4:50-5:00/km (Tue Sep 22)"],
    lifts: ["Upper body (Mon)", "Lower body (Wed) - Sep 23 is the last hard leg day"],
    purpose:
      "The Sep 15 test is the same decision-point formula that worked for the 10K: hold 3km at goal pace and you know sub-25 is real. Then the 4x1km session - the workout that got you to Foxtrail fitness - locks in goal pace under fatigue.",
    keyPoint:
      "Sep 15 test: controlled-but-hard → sub-25 locked. Felt easy → target 24:15-24:30. Couldn't hold past 2km → race for 25:30 with a negative split and let race-day adrenaline do the rest (it was worth minutes in April).",
  },
  {
    number: 4,
    dates: "Sep 28 - Oct 4",
    theme: "Taper + Race",
    volume: "~10 km + Race",
    color: "border-purple-600",
    headerBg: "bg-gradient-to-r from-purple-50 to-pink-50",
    zone2: ["Easy + strides (4 km Tue)", "Shakeout 2 km Sat - perfect partner run"],
    zone5: ["Sharpener: 3x400m @ race pace, full recovery (Thu)", "RACE DAY - Sunday October 4!"],
    lifts: ["Light upper body Monday only - no legs all week"],
    purpose:
      "Volume drops hard so the speed you built can surface. The Thursday 3x400 at race pace should feel automatic - that's the point. By Sunday your legs are springs.",
    keyPoint:
      "You might feel sluggish mid-week - that's the taper working, same as April. Trust it. Lay out race gear Saturday night.",
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
        <p className="text-blue-100 text-sm mb-4">40-Day Plan - Oakville 5K - Sunday October 4, 2026</p>
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
            This is a <span className="font-semibold">6-week block built on what worked in April</span>:
            you went from a 7:22/km baseline to racing 5:31/km at Foxtrail in six weeks. A 5K needs
            less volume and more speed than the 10K did, so the plan is 3-4 runs a week around your lifts:
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                <Zap className="h-4 w-4" />
                Tuesday Speed
              </div>
              <p className="text-sm text-red-900/80">
                One hard session a week: 400s, then 800s, then a race pace test, then the 4x1km
                April Special. This is what moves you from 26:30 fitness to sub-25.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
                <Heart className="h-4 w-4" />
                Zone 2 Everything Else
              </div>
              <p className="text-sm text-green-900/80">
                Thursday and Sunday stay genuinely easy (6:30-7:15/km), and the partner run is
                real recovery volume - conversational pace, no sneaking it down.
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-indigo-800 mb-2">
                <Target className="h-4 w-4" />
                Decision Points
              </div>
              <p className="text-sm text-indigo-900/80">
                The Aug 27 benchmark and Sep 15 race pace test decide the target: 24:30 stretch,
                sub-25 goal, or 25:30 fallback. Same formula that called your 10K correctly.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Lower body lifts land the day after speed work - hard days hard, easy days easy.
            Weekend runs are moveable; the Tuesday session is the one that can&apos;t be skipped.
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
                <p className="text-sm font-medium">KM 1: Conservative Start</p>
                <p className="text-xs text-muted-foreground">
                  Run 5:03/km. April taught us the adrenaline trap - going out fast feels free
                  and costs you the last kilometre. Settle in and find your rhythm.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
              <div className="bg-purple-100 text-purple-700 font-bold text-sm rounded-full h-7 w-7 flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="text-sm font-medium">KM 2-4: Lock Into Goal Pace</p>
                <p className="text-xs text-muted-foreground">
                  Hold 5:00/km. This is the pace you rehearsed in the test and the 4x1km session.
                  Stay relaxed, focus on form, tick them off one at a time.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
              <div className="bg-purple-100 text-purple-700 font-bold text-sm rounded-full h-7 w-7 flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="text-sm font-medium">KM 5: Empty the Tank</p>
                <p className="text-xs text-muted-foreground">
                  One kilometre left - push to 4:45-4:50/km. In a 5K there is no saving anything.
                  If you cross the line thinking you had more, you paced it wrong.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Target splits: 5:03 (1K) → 10:03 (2K) → 15:03 (3K) → 20:03 (4K) → 24:50 (finish)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
