import { CheckCircle2, MinusCircle } from "lucide-react";

export type WeekStats = {
  runsPlanned: number;
  runsCompleted: number;
  plannedKm: number;
  actualKm: number;
  qualityTitle?: string;
  qualityCompleted: boolean;
  qualityPace?: string;
  longestRunKm: number;
};

/** Three-up summary of a training week: runs, volume, and the quality session. */
export function WeekStatsGrid({ stats }: { stats: WeekStats }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="bg-muted/60 rounded-lg p-2">
        <div className="text-lg font-bold">
          {stats.runsCompleted}
          <span className="text-sm font-normal text-muted-foreground">/{stats.runsPlanned}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Runs</div>
      </div>
      <div className="bg-muted/60 rounded-lg p-2">
        <div className="text-lg font-bold">
          {stats.actualKm}
          <span className="text-sm font-normal text-muted-foreground">/{stats.plannedKm} km</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Volume</div>
      </div>
      <div className="bg-muted/60 rounded-lg p-2">
        <div className="text-lg font-bold flex items-center justify-center gap-1">
          {stats.qualityCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <MinusCircle className="h-4 w-4 text-muted-foreground" />
          )}
          {stats.qualityPace && <span className="text-sm">{stats.qualityPace}</span>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {stats.qualityTitle ? stats.qualityTitle.replace(/^(BENCHMARK|RACE PACE TEST):?\s*/, "") : "Quality"}
        </div>
      </div>
    </div>
  );
}
