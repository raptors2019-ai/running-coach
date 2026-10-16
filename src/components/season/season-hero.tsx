import { format, parseISO } from "date-fns";
import { seasonProgress } from "../../../convex/lib/season";
import { formatDuration, secondsToPace } from "@/lib/pace-utils";
import { pointAlong, trailFraction, TRAIL } from "./trail";
import type { ActiveSeason } from "./types";

const SNOW: [number, number, number][] = [
  [40, 22, 1.6], [96, 12, 1.2], [150, 30, 1.8], [236, 14, 1.3], [20, 56, 1.2], [300, 64, 1.5],
];

const GOAL_TONES = [
  "bg-slot-long text-[#0d1b45]",
  "bg-sunrise text-sunrise-ink",
];

/** The season's trail map: base camp to the 10K summit to the 5K summit, with you on it. */
export function SeasonHero({ active }: { active: ActiveSeason }) {
  const { season, progress } = active;
  const tenK = season.goals.find((g) => g.distanceKm === 10);
  const tenKProgress = tenK ? seasonProgress(season, tenK.byDate) : 0.5;
  const [youX, youY] = pointAlong(TRAIL.points, trailFraction(progress, tenKProgress));
  const trail = TRAIL.points.map(([x, y]) => `${x},${y}`).join(" ");
  const current = active.phase?.phase;

  return (
    <section className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] bg-winter-navy p-[18px] pb-4 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sun">THE WINTER CLIMB</p>
          <h2 className="font-display text-2xl font-extrabold">{season.name}</h2>
        </div>
        <span className="mt-1 text-xs text-winter-frost">
          {format(parseISO(season.startDate), "MMM d")} → {format(parseISO(season.endDate), "MMM d")}
        </span>
      </div>

      <svg
        viewBox="0 0 354 150"
        className="block h-auto w-full"
        role="img"
        aria-label={`Trail map: you are ${Math.round(progress * 100)}% of the way through the season`}
      >
        {SNOW.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#c9d3ff" />
        ))}
        <circle cx="70" cy="40" r="7" fill="#ffd23f" />
        <path d="M0 150 L58 92 L96 118 L168 54 L214 96 L262 40 L304 82 L354 46 L354 150 Z" fill="#33407a" />
        <path d="M168 54 L184 68 L176 70 L168 62 L160 72 L154 67 Z" fill="#fff" />
        <path d="M262 40 L276 53 L268 55 L262 48 L255 57 L249 52 Z" fill="#fff" />
        <path d="M0 150 L36 122 L84 138 L140 104 L206 132 L262 112 L318 128 L354 116 L354 150 Z" fill="#283573" />
        <polyline
          points={trail}
          fill="none"
          stroke="#ffd23f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 8"
        />
        <path d={`M${TRAIL.tenKSummit[0]} ${TRAIL.tenKSummit[1]} v-24`} stroke="#fff" strokeWidth="2" />
        <path d={`M${TRAIL.tenKSummit[0]} ${TRAIL.tenKSummit[1] - 24} l16 5 l-16 6 Z`} fill="#4c8dff" />
        <path d={`M${TRAIL.fiveKSummit[0]} ${TRAIL.fiveKSummit[1]} v-22`} stroke="#fff" strokeWidth="2" />
        <path d={`M${TRAIL.fiveKSummit[0]} ${TRAIL.fiveKSummit[1] - 22} l16 5 l-16 6 Z`} fill="#ff7a45" />
        <circle cx={youX} cy={youY} r="11" fill="#ff7a45" opacity="0.3">
          <animate attributeName="r" values="8;13;8" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={youX} cy={youY} r="6" fill="#ff7a45" stroke="#fff" strokeWidth="2" />
      </svg>

      <div className="-mt-1 flex justify-between text-[11px] font-semibold">
        {season.phases.map((p) => (
          <span
            key={p.key}
            className={
              p.key === current?.key ? "flex items-center gap-1 text-[#ffb593]" : "text-winter-frost"
            }
          >
            {p.key === current?.key && <span className="h-2 w-2 rounded-full bg-sunrise" aria-hidden="true" />}
            {p.key === current?.key ? `You · ${p.name}` : p.name}
          </span>
        ))}
      </div>

      {current?.focus && <p className="text-[13px] leading-snug text-winter-frost">{current.focus}</p>}

      <div className="grid grid-cols-2 gap-2">
        {season.goals.map((g, i) => (
          <div key={g.label} className={`flex flex-col gap-0.5 rounded-[14px] p-3 ${GOAL_TONES[i % GOAL_TONES.length]}`}>
            <span className="text-[11px] font-semibold uppercase">
              {g.label} summit · {format(parseISO(g.byDate), "MMM d")}
            </span>
            <span className="font-display text-2xl font-extrabold">sub-{formatDuration(g.targetSeconds).replace(/:00$/, "")}</span>
            <span className="text-[11px]">{secondsToPace(g.targetSeconds / g.distanceKm)}/km</span>
          </div>
        ))}
      </div>
    </section>
  );
}
