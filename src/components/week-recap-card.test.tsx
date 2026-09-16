import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "fs";
import { WeekRecapCard } from "./week-recap-card";
import {
  buildWeekRecap,
  defaultCaption,
  RecapMode,
  RecapWorkout,
  weekHighlight,
} from "@/lib/week-recap";

/** Mondays of the two weeks these fixtures live in. */
const WEEK3 = "2026-09-07";
const WEEK1 = "2026-08-24";

/** A full week: speed day, two easy runs, a long run and two lifts. */
const fullWeek: RecapWorkout[] = [
  { date: "2026-09-07", weekNumber: 3, type: "upper_body", title: "Upper Body", completed: true },
  { date: "2026-09-08", weekNumber: 3, type: "intervals", title: "5x800m @ 4:50", completed: true, targetDistance: 8, actualDistance: 8.12, actualDuration: 2735, actualPace: "5:37/km", avgHeartRate: 174 },
  { date: "2026-09-09", weekNumber: 3, type: "lower_body", title: "Lower Body", completed: true },
  { date: "2026-09-10", weekNumber: 3, type: "easy", title: "Zone 2", completed: true, targetDistance: 5, actualDistance: 5.21, actualDuration: 2213, actualPace: "7:05/km" },
  { date: "2026-09-12", weekNumber: 3, type: "easy", title: "Partner run", completed: true, targetDistance: 2.5, actualDistance: 2.62, actualDuration: 1180, actualPace: "7:30/km" },
  { date: "2026-09-13", weekNumber: 3, type: "long", title: "Long run", completed: true, targetDistance: 9, actualDistance: 9.14, actualDuration: 3839, actualPace: "7:00/km" },
];

/** A thin week: one run with no Strava numbers behind it, two runs missed. */
const sparseWeek: RecapWorkout[] = [
  { date: "2026-08-25", weekNumber: 1, type: "easy", title: "4km easy + 4x100m strides", completed: true, targetDistance: 4 },
  { date: "2026-08-27", weekNumber: 1, type: "tempo", title: "2K benchmark time trial", completed: true, targetDistance: 4.5, actualDistance: 4.48, actualDuration: 1720, actualPace: "6:24/km" },
  { date: "2026-08-29", weekNumber: 1, type: "easy", title: "Partner run", completed: false, targetDistance: 2.5 },
  { date: "2026-08-30", weekNumber: 1, type: "easy", title: "Zone 2", completed: false, targetDistance: 5 },
];

function render(workouts: RecapWorkout[], weekStart: string, mode: RecapMode = "runs"): string {
  const recap = buildWeekRecap(workouts, weekStart, mode)!;
  const svg = renderToStaticMarkup(
    <WeekRecapCard
      recap={recap}
      caption={defaultCaption(recap)}
      highlight={weekHighlight(recap)}
      raceName="Oakville 5K"
      goalLabel="Sub-25 · Oct 4"
      daysToRace={18}
    />
  );
  // Set PREVIEW_OUT to drop the rendered card on disk and eyeball the layout.
  if (process.env.PREVIEW_OUT) writeFileSync(`${process.env.PREVIEW_OUT}/${mode}.svg`, svg);
  return svg;
}

/** The card's visible words, with the markup and its huge attribute noise gone. */
function text(svg: string): string {
  return svg
    .replace(/<[^>]+>/g, "\u0000")
    .replace(/&#x27;/g, "'")
    .split("\u0000")
    .filter(Boolean)
    .join(" | ");
}

describe("WeekRecapCard", () => {
  it("puts the week's headline numbers on the runs-only card", () => {
    const words = text(render(fullWeek, WEEK3));
    expect(words).toContain("25.1"); // total km
    expect(words).toContain("5:37"); // fastest pace
    expect(words).toContain("4 runs");
    // The caption wraps across two lines, so it arrives in two pieces.
    expect(words).toContain("s/o to me for putting in | the work");
    expect(words).toContain("EVERY RUN ON THE BOARD");
    // No lift rows, and none of the week's lift days marked on the chart.
    expect(words).not.toContain("Upper Body");
    expect(words).not.toContain("lifts");
  });

  it("lists the lifts alongside the runs in all mode, without moving the numbers", () => {
    const words = text(render(fullWeek, WEEK3, "all"));
    expect(words).toContain("4 runs · 2 lifts");
    expect(words).toContain("Upper Body");
    expect(words).toContain("Lower Body");
    expect(words).not.toContain("STRENGTH"); // no tag repeating the title
    expect(words).toContain("25.1"); // lifts add no distance
  });

  it("renders a week where a run has no pace and days sit empty", () => {
    const words = text(render(sparseWeek, WEEK1));
    expect(words).toContain("8.5"); // 4 target km + 4.48 measured
    expect(words).toContain("2 RUNS IN THE BANK");
    expect(words).toContain("2/4 PLANNED RUNS DONE");
  });

  it("keeps an overflowing week inside the card", () => {
    // Nine entries in one week: seven rows plus the "+N more" line, and the
    // list must stay above the footer rule at y=1284.
    const busy = [
      ...fullWeek,
      { date: "2026-09-09", weekNumber: 3, type: "cross_training", title: "Cross Training", completed: true, actualDuration: 4907 },
      { date: "2026-09-11", weekNumber: 3, type: "cross_training", title: "Cross Training", completed: true, actualDuration: 3194 },
      { date: "2026-09-12", weekNumber: 3, type: "swim", title: "Swim", completed: true, actualDuration: 1075 },
    ];
    const svg = render(busy, WEEK3, "all");
    const words = text(svg);
    expect(words).toContain("+2 more sessions");
    // Every run still has its row; only sessions were dropped.
    expect(words).toContain("5x800m @ 4:50");
    expect(words).toContain("Zone 2");
    expect(words).toContain("Partner run");
    expect(words).toContain("Long run");
    const lastY = Math.max(
      ...[...svg.matchAll(/<text[^>]*\sy="(\d+(?:\.\d+)?)"[^>]*>(?:(?!<\/text>).)*more sessions/g)].map(
        (m) => Number(m[1])
      )
    );
    expect(lastY).toBeLessThan(1284);
  });

  it("never emits a NaN coordinate, whatever the week holds", () => {
    expect(render(fullWeek, WEEK3)).not.toContain("NaN");
    expect(render(fullWeek, WEEK3, "all")).not.toContain("NaN");
    expect(render(sparseWeek, WEEK1)).not.toContain("NaN");
    // A single completed run: the bar scale and the row band both degrade to one.
    expect(render([sparseWeek[0]], WEEK1)).not.toContain("NaN");
  });
});
