"use client";

import { forwardRef } from "react";
import { formatDuration } from "@/lib/pace-utils";
import { selectRows, truncate, WeekRecap, wrapText } from "@/lib/week-recap";

export const RECAP_WIDTH = 1080;
export const RECAP_HEIGHT = 1350;
/** The caption's line budget on the card; the post itself can say more. */
export const CAPTION_LINES = 2;
export const CAPTION_CHARS = 26;

/** System stack only — an exported PNG can't carry a webfont with it. */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const PAD = 72;
const RIGHT = RECAP_WIDTH - PAD;
const ACCENT = "#FF6B2C";
const ACCENT_SOFT = "#FFB020";
const MUTED = "#8A94A6";
const HAIRLINE = "rgba(255,255,255,0.10)";

// One fixed vertical rhythm, so a short caption and a long one produce the
// same card and nothing can slide into the section below it.
const CAPTION_TOP = 264;
const CAPTION_LINE = 76;
const HIGHLIGHT_Y = 400;
const HERO_LABEL_Y = 470;
const HERO_Y = 588;
const STAT_VALUE_Y = 686;
const BARS_BASE = 890;
const BAR_MAX = 96;
const ROWS_BAND_TOP = 984;
const ROWS_BAND_BOTTOM = 1284;
/** Rows the band fits, counting the "+N more" line when one is needed. */
const MAX_ROWS = 8;

/**
 * Row height and type size per row count. A week with lifts in it runs to
 * twice the rows of a runs-only week, so the list tightens instead of
 * spilling everything past the first five into "+N more".
 */
const ROW_METRICS: Record<number, { height: number; font: number }> = {
  6: { height: 46, font: 29 },
  7: { height: 41, font: 27 },
  8: { height: 36, font: 24 },
};
const DEFAULT_ROW_METRICS = { height: 52, font: 30 };

interface WeekRecapCardProps {
  recap: WeekRecap;
  caption: string;
  /** Accent line under the caption — how the week went against the plan. */
  highlight?: string;
  /** "Oakville 5K" — the block this week belongs to. */
  raceName: string;
  /** "Sub-25 · Oct 4" — goal line for the footer. */
  goalLabel: string;
  /** Countdown chip, omitted once the race has been run. */
  daysToRace?: number;
}

function Stat({ x, value, label, anchor = "start" }: {
  x: number;
  value: string;
  label: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <>
      <text x={x} y={STAT_VALUE_Y} textAnchor={anchor} fill="#FFFFFF" fontFamily={FONT} fontSize={52} fontWeight={700}>
        {value}
      </text>
      <text x={x} y={STAT_VALUE_Y + 38} textAnchor={anchor} fill={MUTED} fontFamily={FONT} fontSize={22} fontWeight={600} letterSpacing={2.5}>
        {label}
      </text>
    </>
  );
}

/**
 * The week as a poster: one 1080x1350 SVG, drawn the same on screen as in the
 * PNG the share button hands to the phone.
 */
export const WeekRecapCard = forwardRef<SVGSVGElement, WeekRecapCardProps>(
  function WeekRecapCard({ recap, caption, highlight, raceName, goalLabel, daysToRace }, ref) {
    const captionLines = wrapText(caption, CAPTION_CHARS, CAPTION_LINES);
    const { rows, hidden: hiddenRows } = selectRows(recap.entries, MAX_ROWS);

    // Centre the run list in the band between the bars and the footer, so a
    // two-run week doesn't leave a hole under it.
    const rowCount = rows.length + (hiddenRows > 0 ? 1 : 0);
    const { height: rowHeight, font: rowFont } = ROW_METRICS[rowCount] ?? DEFAULT_ROW_METRICS;
    const rowsTop =
      ROWS_BAND_TOP + (ROWS_BAND_BOTTOM - ROWS_BAND_TOP - rowCount * rowHeight) / 2 + rowFont;

    const maxKm = Math.max(...recap.days.map((d) => d.km), 1);
    const barSlot = (RECAP_WIDTH - PAD * 2) / 7;
    const barWidth = 54;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${RECAP_WIDTH} ${RECAP_HEIGHT}`}
        width={RECAP_WIDTH}
        height={RECAP_HEIGHT}
        className="w-full h-auto rounded-xl shadow-lg"
        role="img"
        aria-label={`${recap.weekLabel} recap: ${recap.totalKm} km over ${recap.runCount} runs`}
      >
        <defs>
          <linearGradient id="recap-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#11161F" />
            <stop offset="100%" stopColor="#070A0E" />
          </linearGradient>
          <linearGradient id="recap-bar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={ACCENT} />
            <stop offset="100%" stopColor={ACCENT_SOFT} />
          </linearGradient>
          <radialGradient id="recap-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.30" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={RECAP_WIDTH} height={RECAP_HEIGHT} fill="url(#recap-bg)" />
        <circle cx={880} cy={120} r={420} fill="url(#recap-glow)" />

        {/* Header */}
        <text x={PAD} y={100} fill="#FFFFFF" fontFamily={FONT} fontSize={40} fontWeight={800} letterSpacing={1}>
          {recap.weekLabel.toUpperCase()}
          {recap.weekTitle ? (
            <tspan fill={MUTED} fontWeight={600}>{`  ·  ${truncate(recap.weekTitle, 20)}`}</tspan>
          ) : null}
        </text>
        <text x={PAD} y={146} fill={MUTED} fontFamily={FONT} fontSize={28} fontWeight={600} letterSpacing={2}>
          {recap.rangeLabel.toUpperCase()}
        </text>
        <text x={RIGHT} y={100} textAnchor="end" fill={ACCENT} fontFamily={FONT} fontSize={30} fontWeight={800} letterSpacing={3}>
          {raceName.toUpperCase()}
        </text>
        {daysToRace !== undefined && daysToRace >= 0 && (
          <text x={RIGHT} y={146} textAnchor="end" fill={MUTED} fontFamily={FONT} fontSize={28} fontWeight={600} letterSpacing={2}>
            {daysToRace === 0 ? "RACE DAY" : `${daysToRace} DAYS OUT`}
          </text>
        )}
        <rect x={PAD} y={180} width={RECAP_WIDTH - PAD * 2} height={2} fill={HAIRLINE} />

        {/* Caption */}
        {captionLines.map((line, i) => (
          <text
            key={i}
            x={PAD}
            y={CAPTION_TOP + i * CAPTION_LINE}
            fill="#FFFFFF"
            fontFamily={FONT}
            fontSize={62}
            fontWeight={800}
          >
            {line}
          </text>
        ))}
        {highlight && (
          <text x={PAD} y={HIGHLIGHT_Y} fill={ACCENT} fontFamily={FONT} fontSize={30} fontWeight={800} letterSpacing={3}>
            {truncate(highlight, 46).toUpperCase()}
          </text>
        )}

        {/* Hero volume */}
        <text x={PAD} y={HERO_LABEL_Y} fill={MUTED} fontFamily={FONT} fontSize={24} fontWeight={700} letterSpacing={4}>
          VOLUME
        </text>
        <text x={PAD} y={HERO_Y} fill="#FFFFFF" fontFamily={FONT} fontSize={136} fontWeight={800} letterSpacing={-4}>
          {recap.totalKm.toFixed(1)}
          <tspan fill={ACCENT} fontSize={58} fontWeight={800} letterSpacing={0}>{" km"}</tspan>
        </text>
        <text x={RIGHT} y={HERO_Y} textAnchor="end" fill={MUTED} fontFamily={FONT} fontSize={30} fontWeight={700}>
          {`${recap.runCount} ${recap.runCount === 1 ? "run" : "runs"}`}
          {recap.mode === "all" && recap.supportSummary ? ` · ${recap.supportSummary}` : ""}
        </text>

        {/* Stat row */}
        <Stat x={PAD} value={recap.longestKm > 0 ? `${recap.longestKm.toFixed(1)}` : "—"} label="LONGEST KM" />
        <Stat x={PAD + 240} value={recap.totalSeconds > 0 ? formatDuration(recap.totalSeconds) : "—"} label="MOVING" />
        <Stat x={PAD + 590} value={recap.avgPace ?? "—"} label="AVG /KM" />
        <Stat x={RIGHT} value={recap.fastestPace ?? "—"} label="FASTEST /KM" anchor="end" />
        <rect x={PAD} y={748} width={RECAP_WIDTH - PAD * 2} height={2} fill={HAIRLINE} />

        {/* Daily bars */}
        {recap.days.map((day, i) => {
          const cx = PAD + barSlot * i + barSlot / 2;
          const height = day.km > 0 ? Math.max(10, (day.km / maxKm) * BAR_MAX) : 0;
          return (
            <g key={day.date}>
              {day.km > 0 ? (
                <>
                  <rect
                    x={cx - barWidth / 2}
                    y={BARS_BASE - height}
                    width={barWidth}
                    height={height}
                    rx={12}
                    fill="url(#recap-bar)"
                  />
                  <text
                    x={cx}
                    y={BARS_BASE - height - 16}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontFamily={FONT}
                    fontSize={26}
                    fontWeight={700}
                  >
                    {day.km.toFixed(1)}
                  </text>
                </>
              ) : (
                <rect
                  x={cx - barWidth / 2}
                  y={BARS_BASE - (day.session ? 26 : 8)}
                  width={barWidth}
                  height={day.session ? 26 : 8}
                  rx={day.session ? 8 : 4}
                  fill={day.session ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)"}
                />
              )}
              <text
                x={cx}
                y={BARS_BASE + 46}
                textAnchor="middle"
                fill={day.km > 0 ? "#FFFFFF" : MUTED}
                fontFamily={FONT}
                fontSize={26}
                fontWeight={700}
                letterSpacing={1}
              >
                {day.day.toUpperCase()}
              </text>
            </g>
          );
        })}
        <rect x={PAD} y={1000} width={RECAP_WIDTH - PAD * 2} height={2} fill={HAIRLINE} />

        {/* Run-by-run */}
        {rows.map((entry, i) => {
          const y = rowsTop + i * rowHeight;
          const badge = entry.isFastest ? "FASTEST" : entry.isLongest ? "LONGEST" : null;
          return (
            <g key={entry.date + entry.title}>
              <text x={PAD} y={y} fill={MUTED} fontFamily={FONT} fontSize={rowFont - 2} fontWeight={700} letterSpacing={1}>
                {entry.day.toUpperCase()}
              </text>
              <text
                x={PAD + 92}
                y={y}
                fill={entry.isRun ? "#FFFFFF" : MUTED}
                fontFamily={FONT}
                fontSize={rowFont}
                fontWeight={600}
              >
                {truncate(entry.title, badge ? 20 : 30)}
              </text>
              {badge && (
                <text
                  x={RIGHT - 320}
                  y={y}
                  textAnchor="end"
                  fill={ACCENT}
                  fontFamily={FONT}
                  fontSize={rowFont - 8}
                  fontWeight={800}
                  letterSpacing={2}
                >
                  {badge}
                </text>
              )}
              <text
                x={RIGHT - 170}
                y={y}
                textAnchor="end"
                fill={entry.isRun ? "#FFFFFF" : MUTED}
                fontFamily={FONT}
                fontSize={rowFont}
                fontWeight={700}
              >
                {entry.isRun ? `${entry.distanceKm.toFixed(2)} km` : ""}
              </text>
              <text
                x={RIGHT}
                y={y}
                textAnchor="end"
                fill={entry.isFastest ? ACCENT : MUTED}
                fontFamily={FONT}
                fontSize={rowFont}
                fontWeight={700}
              >
                {entry.isRun
                  ? entry.pace
                    ? `${entry.pace}/km`
                    : "—"
                  : entry.durationSeconds
                    ? formatDuration(entry.durationSeconds)
                    : "—"}
              </text>
            </g>
          );
        })}
        {hiddenRows > 0 && (
          <text x={PAD} y={rowsTop + rows.length * rowHeight} fill={MUTED} fontFamily={FONT} fontSize={rowFont - 4} fontWeight={600}>
            +{hiddenRows} more {hiddenRows === 1 ? "session" : "sessions"}
          </text>
        )}

        {/* Footer */}
        <rect x={PAD} y={1284} width={RECAP_WIDTH - PAD * 2} height={2} fill={HAIRLINE} />
        <text x={PAD} y={1322} fill="#FFFFFF" fontFamily={FONT} fontSize={28} fontWeight={700} letterSpacing={1}>
          {goalLabel.toUpperCase()}
        </text>
        <text x={RIGHT} y={1322} textAnchor="end" fill={MUTED} fontFamily={FONT} fontSize={28} fontWeight={600} letterSpacing={2}>
          {recap.plannedRuns > 0
            ? `${recap.plannedDone}/${recap.plannedRuns} PLANNED RUNS DONE`
            : `${recap.runCount} ${recap.runCount === 1 ? "RUN" : "RUNS"} LOGGED`}
        </text>
      </svg>
    );
  }
);
