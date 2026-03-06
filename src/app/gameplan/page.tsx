"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil } from "@/lib/pace-utils";
import { RACE_DATE, GOAL_PACE, CURRENT_PACE } from "@/lib/constants";
import { ArrowLeft, Target, Heart, Zap, Trophy, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const WEEKS = [
  {
    number: 1,
    dates: "Mar 5 - 11",
    theme: "Baseline + Speed Intro",
    volume: "~25 km",
    color: "border-green-400",
    headerBg: "bg-green-50",
    zone2: ["Easy run (5 km) at 7:00-7:30/km", "Long run (8 km) at 6:30-7:15/km"],
    zone5: ["Speed intervals: 6x400m at 5:15-5:40/km with 90s rest", "Basketball (cross-training)"],
    purpose:
      "Establish your baseline fitness and introduce speed work safely. This week is about finding your rhythm and getting your body used to structured training.",
    keyPoint:
      "Don't go out too fast on runs. The easy runs should feel genuinely easy - you should be able to hold a conversation. Save the speed for intervals.",
  },
  {
    number: 2,
    dates: "Mar 12 - 18",
    theme: "Build Volume + Speed",
    volume: "~36 km",
    color: "border-blue-400",
    headerBg: "bg-blue-50",
    zone2: ["Easy runs at conversational pace", "Long run (10 km) - building endurance"],
    zone5: ["800m repeats - longer intervals build lactate tolerance", "Basketball"],
    purpose:
      "A significant 44% volume increase. The longer intervals (800m vs 400m) train your body to sustain faster paces for longer periods.",
    keyPoint:
      "This is where you start building your aerobic engine. The jump in volume is intentional - your body adapts quickly in the first few weeks.",
  },
  {
    number: 3,
    dates: "Mar 19 - 25",
    theme: "Peak Volume",
    volume: "~38.5 km",
    color: "border-red-400",
    headerBg: "bg-red-50",
    zone2: ["Easy run for active recovery", "Long run (11 km) - the longest run of the plan", "Recovery run"],
    zone5: ["1K repeats - race-distance intervals", "Basketball"],
    purpose:
      "The highest training load of the entire plan. This is where you maximize aerobic adaptations and push your ceiling higher.",
    keyPoint:
      "Fatigue is expected and normal. You might feel tired mid-week - that's the training working. Prioritize sleep and nutrition.",
  },
  {
    number: 4,
    dates: "Mar 26 - Apr 1",
    theme: "Recovery / Deload",
    volume: "~24 km",
    color: "border-emerald-400",
    headerBg: "bg-emerald-50",
    zone2: ["Easy runs at relaxed effort", "Long run (8 km) - shorter than previous weeks"],
    zone5: ["Tempo run - sustained effort practice", "Basketball"],
    purpose:
      "Let your body absorb the fitness gains from weeks 1-3. Volume drops 38% to allow recovery while maintaining the training stimulus.",
    keyPoint:
      "Fitness is built during recovery, not during training. The hard work is done - now your body adapts. Don't skip this week or add extra runs.",
  },
  {
    number: 5,
    dates: "Apr 2 - 8",
    theme: "Sharpening",
    volume: "~35 km",
    color: "border-amber-400",
    headerBg: "bg-amber-50",
    zone2: ["Easy run", "Recovery run"],
    zone5: ["Race pace run: 6 km at goal pace (6:00/km)", "Fast 400s for leg speed", "Basketball"],
    purpose:
      "Race-specific preparation. You'll practice running at your goal pace for an extended distance, building both physical and mental confidence.",
    keyPoint:
      "The 6 km race pace run is the key workout. If you can hold 6:00/km for 6 km, you know the fitness is there for race day.",
  },
  {
    number: 6,
    dates: "Apr 9 - 15",
    theme: "Taper",
    volume: "~20 km",
    color: "border-purple-400",
    headerBg: "bg-purple-50",
    zone2: ["Easy runs with strides (short accelerations)", "Light maintenance runs"],
    zone5: ["Short tempo (3 km) - keep the engine sharp"],
    purpose:
      "Volume drops 45% while maintaining some intensity. Your body is supercompensating - storing energy and repairing muscle fibers for race day.",
    keyPoint:
      "Skip basketball this week. You might feel restless or sluggish - that's normal during a taper. Trust the process. Your body is getting ready to peak.",
  },
  {
    number: 7,
    dates: "Apr 16 - 18",
    theme: "Race Week",
    volume: "Race Day!",
    color: "border-purple-600",
    headerBg: "bg-gradient-to-r from-purple-50 to-pink-50",
    zone2: ["Shakeout run (2 km) two days before - just loosen the legs"],
    zone5: ["RACE DAY - April 18!"],
    purpose:
      "Rest, stay calm, and execute. Everything has been building to this moment. You've done 6 weeks of training - now it's time to race.",
    keyPoint:
      "Trust the training. Start at 6:10/km for the first 2 km, settle into 6:00/km, and if you feel good at 7 km, push to 5:50/km.",
  },
];

function WeekCard({ week }: { week: (typeof WEEKS)[number] }) {
  const [open, setOpen] = useState(week.number <= 2);

  return (
    <Card className={`border-l-4 ${week.color}`}>
      <button
        className={`w-full text-left ${week.headerBg} rounded-t-lg`}
        onClick={() => setOpen(!open)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Week {week.number} - {week.theme}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {week.dates} | {week.volume}
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
          <p className="text-sm">{week.purpose}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-green-800 mb-2">
                <Heart className="h-3.5 w-3.5" />
                Zone 2 (Aerobic)
              </div>
              <ul className="space-y-1">
                {week.zone2.map((item, i) => (
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
                {week.zone5.map((item, i) => (
                  <li key={i} className="text-sm text-red-900/80 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-sm text-amber-900">
              <span className="font-medium">Key point:</span> {week.keyPoint}
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
        <p className="text-blue-100 text-sm mb-4">Sub-60 Minute 10K - April 18, 2026</p>
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
            This plan uses a <span className="font-semibold">polarized training approach</span> -
            the same method used by elite endurance athletes. Instead of running at moderate effort
            every day, training is split between two intensity zones:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
                <Heart className="h-4 w-4" />
                Zone 2 - Easy/Long Runs
              </div>
              <p className="text-sm text-green-900/80">
                ~70% of training volume. Builds your aerobic base - the foundation of endurance.
                These runs improve fat oxidation, capillary density, and mitochondrial function.
                They should feel easy enough to hold a conversation.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                <Zap className="h-4 w-4" />
                Zone 5 - Speed Work
              </div>
              <p className="text-sm text-red-900/80">
                ~30% of volume through intervals, tempo runs, and basketball. Develops VO2max,
                running economy, and lactate clearance. Basketball provides natural interval
                training with sprints, cuts, and jumps.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Why does this work? Research shows that avoiding the &quot;moderate intensity trap&quot; (running
            too hard on easy days, too easy on hard days) produces faster adaptations. Easy days let
            you recover, so you can go truly hard on speed days.
          </p>
        </CardContent>
      </Card>

      {/* Week by Week */}
      <div>
        <h2 className="text-lg font-bold mb-3">Week-by-Week Breakdown</h2>
        <div className="space-y-4">
          {WEEKS.map((week) => (
            <WeekCard key={week.number} week={week} />
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
