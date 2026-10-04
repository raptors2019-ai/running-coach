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

// ---------------------------------------------------------------------------
// Stickers: one Strava-style tile per run, scattered over the frame.

import {
  STICKER_HEIGHT,
  STICKER_ROUTE_BOX,
  STICKER_WIDTH,
  type Sticker,
  type StickerLayout,
} from "@/lib/route-overlay";

import { POP_SECONDS, popState, stickerTimeline, type PopState } from "@/lib/sticker-timeline";

/** Where the month totals card sits in the sticker collage. */
export const TOTALS_CARD = { x: 150, y: 1480, width: 780, height: 270 };

export interface StickerTotals extends OverlayTotals {
  title: string; // e.g. "September 2026"
}

export interface RouteStickersSvgProps {
  layout: StickerLayout;
  /** Month totals card; omitted for a stickers-only frame. */
  totals?: StickerTotals;
  /** Pop the stickers in one at a time (CSS, runs on its own). */
  animate?: boolean;
  /**
   * Freeze the pop-in at this many seconds instead: one exact frame, for
   * rendering video. Overrides `animate`.
   */
  at?: number;
  /** No background: for laying the stickers over video. */
  transparent?: boolean;
  /** Solid black instead of the vignette (keys out cleanly with a Screen blend). */
  black?: boolean;
  className?: string;
  title?: string;
}

export function RouteStickersSvg({
  layout,
  totals,
  animate: animateProp = false,
  at,
  transparent = false,
  black = false,
  className,
  title,
}: RouteStickersSvgProps) {
  const timeline = stickerTimeline(layout.stickers.length, Boolean(totals));
  const frozen = at !== undefined;
  const animate = animateProp && !frozen;
  // CSS delays are measured from mount, so drop the lead-in there.
  const cssDelay = (start: number) => Math.max(0, start - timeline.startOf(0));
  const popAt = (start: number): PopState | undefined => (frozen ? popState(at, start) : undefined);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className={className}
      role="img"
      aria-label={`${title ?? "Runs"}: ${layout.stickers.length} run stickers`}
    >
      {animate && (
        <defs>
          <style>{`
            .sticker { opacity: 0; animation: sticker-pop ${POP_SECONDS}s cubic-bezier(.2,.9,.3,1.2) forwards; }
            @keyframes sticker-pop { from { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(calc(var(--s) * 0.6)); } to { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(var(--s)); } }
            @media (prefers-reduced-motion: reduce) { .sticker { animation-duration: 0.01s; } }
          `}</style>
        </defs>
      )}
      {!transparent && <rect width={layout.width} height={layout.height} fill={black ? "#000000" : "url(#vignette)"} />}
      {!transparent && !black && (
        <defs>
          <radialGradient id="vignette" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#1A1512" />
            <stop offset="100%" stopColor={BG} />
          </radialGradient>
        </defs>
      )}
      {layout.stickers.map((s, i) => (
        <StickerTile key={s.id} sticker={s} animate={animate} delay={cssDelay(timeline.startOf(i))} pop={popAt(timeline.startOf(i))} />
      ))}
      {totals && timeline.totalsAt !== null && (
        <TotalsCard totals={totals} animate={animate} delay={cssDelay(timeline.totalsAt)} pop={popAt(timeline.totalsAt)} />
      )}
    </svg>
  );
}

/** Month summary in the same voice as the stickers: title, then three stats. */
function TotalsCard({ totals, animate, delay, pop }: { totals: StickerTotals; animate: boolean; delay: number; pop?: PopState }) {
  const { x, y, width, height } = TOTALS_CARD;
  const transform = poppedTransform(x, y, width, height, 1, pop);
  const cols = [x + width * 0.2, x + width * 0.5, x + width * 0.8];
  const style = animate
    ? ({ "--tx": `${x}px`, "--ty": `${y}px`, "--s": "1", animationDelay: `${delay.toFixed(2)}s` } as React.CSSProperties)
    : undefined;
  const textShadow = "0 1px 6px rgba(0,0,0,.7)";
  return (
    <g
      className={animate ? "sticker" : undefined}
      transform={animate ? undefined : transform}
      opacity={pop ? pop.opacity : undefined}
      style={style}
      fontFamily={FONT}
    >
      <rect width={width} height={height} rx={28} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.12)" />
      <text x={width / 2} y={64} textAnchor="middle" fill={ORANGE} fontSize={24} fontWeight={800} letterSpacing={6} style={{ textShadow }}>
        {totals.title.toUpperCase()}
      </text>
      {(["Runs", "Km", "Time"] as const).map((label, i) => (
        <g key={label}>
          <text x={cols[i] - x} y={186} textAnchor="middle" fill="#FFFFFF" fontSize={58} fontWeight={700} letterSpacing={-2} style={{ textShadow }}>
            {i === 0 ? String(totals.runs) : i === 1 ? totals.km.toFixed(1) : formatHours(totals.seconds)}
          </text>
          <text x={cols[i] - x} y={230} textAnchor="middle" fill="#D6D0C9" fontSize={18} letterSpacing={4} style={{ textShadow }}>
            {label.toUpperCase()}
          </text>
        </g>
      ))}
    </g>
  );
}

// Running-shoe glyph, drawn in a 24x24 box.
const SHOE_PATH =
  "M3 16.5c0-.8.6-1.5 1.4-1.5h2.2c.9 0 1.7-.3 2.3-.9l1.4-1.4c.5-.5 1.2-.7 1.9-.5l1.1.3c.4.1.8 0 1.1-.3l1.2-1.2c.6-.6 1.5-.6 2.1 0l.3.3c.4.4.9.6 1.5.6H21v3.6c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4ZM3 19h18";

/** Transform for a tile popped to `pop`, scaling about the tile's centre. */
function poppedTransform(x: number, y: number, w: number, h: number, scale: number, pop?: PopState): string {
  const f = pop?.scale ?? 1;
  const dx = (w * (1 - f)) / 2;
  const dy = (h * (1 - f)) / 2;
  return `translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}) scale(${(scale * f).toFixed(3)})`;
}

function StickerTile({ sticker: s, animate, delay, pop }: { sticker: Sticker; animate: boolean; delay: number; pop?: PopState }) {
  const cols = [STICKER_WIDTH * 0.19, STICKER_WIDTH * 0.5, STICKER_WIDTH * 0.81];
  const transform = poppedTransform(s.x, s.y, STICKER_WIDTH * s.scale, STICKER_HEIGHT * s.scale, s.scale, pop);
  const style = animate
    ? ({
        "--tx": `${s.x.toFixed(1)}px`,
        "--ty": `${s.y.toFixed(1)}px`,
        "--s": s.scale.toFixed(3),
        animationDelay: `${delay.toFixed(2)}s`,
      } as React.CSSProperties)
    : undefined;
  const textShadow = "0 1px 6px rgba(0,0,0,.7)";
  return (
    <g
      className={animate ? "sticker" : undefined}
      transform={animate ? undefined : transform}
      opacity={pop ? pop.opacity : undefined}
      style={style}
      fontFamily={FONT}
    >
      <path
        d={s.d}
        fill="none"
        stroke={ORANGE}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.6))" }}
      />
      <text
        x={STICKER_WIDTH / 2}
        y={STICKER_ROUTE_BOX.height + 36}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={20}
        fontWeight={800}
        letterSpacing={4}
        style={{ textShadow }}
      >
        STRAVA
      </text>
      {(["Distance", "Pace", "Time"] as const).map((label, i) => (
        <g key={label}>
          <text x={cols[i]} y={STICKER_ROUTE_BOX.height + 64} textAnchor="middle" fill="#D6D0C9" fontSize={10.5} letterSpacing={0.5} style={{ textShadow }}>
            {label}
          </text>
          <text x={cols[i]} y={STICKER_ROUTE_BOX.height + 86} textAnchor="middle" fill="#FFFFFF" fontSize={17} fontWeight={700} style={{ textShadow }}>
            {i === 0 ? `${s.distance.toFixed(2)} km` : i === 1 ? s.pace : s.time}
          </text>
        </g>
      ))}
      <g transform={`translate(${STICKER_WIDTH / 2 - 14} ${STICKER_HEIGHT - 44}) scale(1.17)`}>
        <path d={SHOE_PATH} fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** One sticker on its own, at scale 1 with its origin at 0,0, for rasterising. */
export function StickerTileSvg({ sticker }: { sticker: Sticker }) {
  const local: Sticker = { ...sticker, x: 0, y: 0, scale: 1 };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${STICKER_WIDTH} ${STICKER_HEIGHT}`} width={STICKER_WIDTH} height={STICKER_HEIGHT}>
      <StickerTile sticker={local} animate={false} delay={0} />
    </svg>
  );
}

/** The totals card on its own, for rasterising. */
export function TotalsCardSvg({ totals }: { totals: StickerTotals }) {
  const { width, height } = TOTALS_CARD;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${TOTALS_CARD.x} ${TOTALS_CARD.y} ${width} ${height}`} width={width} height={height}>
      <TotalsCard totals={totals} animate={false} delay={0} />
    </svg>
  );
}
