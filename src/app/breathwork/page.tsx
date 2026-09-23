"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowLeft, Wind, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BreathworkCard } from "@/components/breathwork-card";
import { DRILLS, type DrillId } from "@/lib/breathwork";

const TABS: { value: string; label: string; intro: string; drills: DrillId[] }[] = [
  {
    value: "off",
    label: "Off feet",
    intro:
      "The 15 minutes you do every day. The morning drill practises the rhythms; the evening one calms you down for sleep. Swim notes are for rest days.",
    drills: ["wake", "sleep", "swim"],
  },
  {
    value: "zone2",
    label: "Zone 2",
    intro: "Easy runs are where breathing technique is worth practising. No extra time, just a different focus.",
    drills: ["zone2"],
  },
  {
    value: "hard",
    label: "Hard runs",
    intro:
      "At high intensity you can't control how fast you breathe, but you can control how fully you exhale. That's all this section is about.",
    drills: ["primer", "hard"],
  },
  {
    value: "race",
    label: "Race day",
    intro: "Your race plan with the breathing added. The 3km checkpoint gets an objective test.",
    drills: ["primer", "race"],
  },
];

function DrillCard({ id }: { id: DrillId }) {
  const drill = DRILLS[id];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-baseline gap-2">
          {drill.name}
          {drill.minutes && (
            <span className="text-xs font-normal text-sky-700">{drill.minutes} min</span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{drill.when}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{drill.why}</p>
        <ol className="space-y-2">
          {drill.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="h-5 w-5 shrink-0 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {drill.caution && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{drill.caution}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BreathworkPage() {
  const workouts = useQuery(api.workouts.getAllWorkouts);

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Today
      </Link>

      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 text-white rounded-2xl p-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wind className="h-6 w-6" />
          Breathwork
        </h1>
        <p className="text-sky-100 text-sm mt-1">
          15 minutes a day, off your feet. The running patterns happen inside runs you&apos;re already doing.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4 text-center">
          <div className="bg-white/10 rounded-lg py-2">
            <div className="text-xl font-bold">3 : 2</div>
            <div className="text-xs text-sky-100">Easy gear: in 3 steps, out 2</div>
          </div>
          <div className="bg-white/10 rounded-lg py-2">
            <div className="text-xl font-bold">2 : 1</div>
            <div className="text-xs text-sky-100">Race gear: in 2, out 1, full exhale</div>
          </div>
        </div>
      </div>

      {workouts && <BreathworkCard workouts={workouts} />}

      <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm space-y-1">
        <p className="font-medium">What this will and won&apos;t do</p>
        <p className="text-muted-foreground">
          In 10 days breathwork won&apos;t raise your VO2max or strengthen your breathing muscles; that takes weeks.
          What it will do is make the 3:2 → 2:1 switch automatic, give you an honest test at the 3km checkpoint,
          keep you from panic-breathing when it hurts, and help you sleep through the taper. That&apos;s worth
          seconds, and on a 23:59 target seconds matter.
        </p>
      </div>

      <Tabs defaultValue="off">
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1 text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.intro}</p>
            {t.drills.map((id) => (
              <DrillCard key={id} id={id} />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          If you get dizzy or tingly, stop and breathe normally. Breath holds only sitting down on dry land, never in
          water or while driving.
        </span>
      </div>
    </div>
  );
}
