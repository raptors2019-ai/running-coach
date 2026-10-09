export interface Vo2maxPoint {
  date: string; // YYYY-MM-DD
  vo2max: number;
}

export interface Vo2maxTrend {
  latest: Vo2maxPoint;
  previous?: Vo2maxPoint;
  change?: number; // latest minus previous, ml/kg/min
  changePerYear?: number; // change scaled to a 365-day year
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Lab tests are months or years apart, so the useful number is the rate of
 * change per year, not just the raw difference between the last two tests.
 */
export function vo2maxTrend(tests: Vo2maxPoint[]): Vo2maxTrend | null {
  if (tests.length === 0) return null;
  const sorted = [...tests].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (sorted.length === 1) return { latest };

  const previous = sorted[sorted.length - 2];
  const change = round1(latest.vo2max - previous.vo2max);
  const years =
    (Date.parse(latest.date + "T12:00:00Z") - Date.parse(previous.date + "T12:00:00Z")) / MS_PER_YEAR;
  // Two tests within a few weeks would turn noise into a huge yearly rate.
  const changePerYear = years >= 0.25 ? round1(change / years) : undefined;
  return { latest, previous, change, changePerYear };
}
