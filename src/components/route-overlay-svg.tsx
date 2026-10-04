import type { OverlayLayout, OverlayTotals } from "@/lib/route-overlay";
import { formatHours } from "@/lib/route-overlay";

export const OVERLAY_WIDTH = 1080;
export const OVERLAY_HEIGHT = 1920;
/** The band between the header and the stats where routes are drawn. */
export const OVERLAY_AREA = { x: 0, y: 300, width: OVERLAY_WIDTH, height: 1200 };

/** Seconds each route takes to draw, and the gap between route starts. */
export const DRAW_SECONDS = 1.4;
export function staggerSeconds(count: number): number {
  return count <= 1 ? 0 : Math.min(0.45, 7 / count);
}

export interface RouteOverlaySvgProps {
  layout: OverlayLayout;
  totals: OverlayTotals;
  title: string; // e.g. "September 2026"
  subtitle?: string;
  /** Draw the routes in one at a time. Off for the exported still. */
  animate?: boolean;
  /** Totals shown while the animation runs; the final totals otherwise. */
  shownTotals?: OverlayTotals;
  className?: string;
}

const ORANGE = "#FC5200";
const BG = "#0B0B0D";
const FONT = "var(--font-geist-sans), 'Helvetica Neue', Arial, system-ui, sans-serif";

export function RouteOverlaySvg({
  layout,
  totals,
  title,
  subtitle,
  animate = false,
  shownTotals,
  className,
}: RouteOverlaySvgProps) {
  const { paths } = layout;
  const stagger = staggerSeconds(paths.length);
  const shown = shownTotals ?? totals;
  const strokeWidth = paths.length > 40 ? 3 : paths.length > 15 ? 3.5 : 4.5;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}`}
      width={OVERLAY_WIDTH}
      height={OVERLAY_HEIGHT}
      className={className}
      role="img"
      aria-label={`${title}: ${totals.runs} runs, ${totals.km.toFixed(1)} km, overlaid routes`}
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#1A1512" />
          <stop offset="100%" stopColor={BG} />
        </radialGradient>
        {animate && (
          <style>{`
            .route { stroke-dasharray: 1; stroke-dashoffset: 1; animation: route-draw ${DRAW_SECONDS}s cubic-bezier(.4,0,.2,1) forwards; }
            @keyframes route-draw { to { stroke-dashoffset: 0; } }
            @media (prefers-reduced-motion: reduce) { .route { animation-duration: 0.01s; } }
          `}</style>
        )}
      </defs>

      <rect width={OVERLAY_WIDTH} height={OVERLAY_HEIGHT} fill="url(#vignette)" />

      {/* Header */}
      <text
        x={72}
        y={150}
        fill="#F5F2EE"
        fontFamily={FONT}
        fontSize={34}
        letterSpacing={10}
        fontWeight={500}
      >
        {subtitle ?? "EVERY RUN"}
      </text>
      <text x={72} y={240} fill="#FFFFFF" fontFamily={FONT} fontSize={82} fontWeight={700} letterSpacing={-2}>
        {title}
      </text>

      {/* Routes: a soft glow pass under a crisp pass. Each path gets
          pathLength=1 so the draw animation is the same length for every run. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) => {
          const style = animate ? { animationDelay: `${(i * stagger).toFixed(2)}s` } : undefined;
          return (
            <g key={p.id}>
              <path
                d={p.d}
                pathLength={1}
                className={animate ? "route" : undefined}
                style={style}
                stroke={ORANGE}
                strokeWidth={strokeWidth * 3}
                strokeOpacity={0.18}
                filter="url(#glow)"
              />
              <path
                d={p.d}
                pathLength={1}
                className={animate ? "route" : undefined}
                style={style}
                stroke={ORANGE}
                strokeWidth={strokeWidth}
                strokeOpacity={0.82}
              />
            </g>
          );
        })}
      </g>

      {/* Footer stats */}
      <g fontFamily={FONT} fill="#FFFFFF">
        <Stat x={72} value={String(shown.runs)} label="RUNS" />
        <Stat x={400} value={shown.km.toFixed(1)} label="KM" />
        <Stat x={740} value={formatHours(shown.seconds)} label="MOVING" />
      </g>
      <line x1={72} y1={1700} x2={1008} y2={1700} stroke="#FFFFFF" strokeOpacity={0.14} />
      <text x={72} y={1752} fill="#B8B2AB" fontFamily={FONT} fontSize={26} letterSpacing={2}>
        ALL ROUTES OVERLAID
      </text>
      <text x={1008} y={1752} textAnchor="end" fill={ORANGE} fontFamily={FONT} fontSize={26} fontWeight={600} letterSpacing={2}>
        STRAVA
      </text>
    </svg>
  );
}

function Stat({ x, value, label }: { x: number; value: string; label: string }) {
  return (
    <g>
      <text x={x} y={1610} fontSize={96} fontWeight={700} letterSpacing={-3}>
        {value}
      </text>
      <text x={x + 4} y={1660} fontSize={26} letterSpacing={6} fill="#B8B2AB">
        {label}
      </text>
    </g>
  );
}
