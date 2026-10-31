import type { MutationCtx } from "./_generated/server";
import { ingestAppleWorkout } from "./appleHealth";
import { parseAppleWorkout, type AppleWorkout } from "./lib/appleHealth";

type Doc = Record<string, unknown> & { _id: string };
type IndexRange = { eq: (field: string, value: unknown) => IndexRange };

/** Just enough of ctx.db for the ingest path: index equality queries, insert, patch, delete. */
function fakeCtx(seed: Record<string, Record<string, unknown>[]>) {
  const tables: Record<string, Doc[]> = { workouts: [], activityDetails: [], activityRoutes: [], trainingPlan: [] };
  let next = 0;
  const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
  const insert = (table: string, doc: Record<string, unknown>) => {
    const _id = `${table}:${++next}`;
    tables[table].push({ ...defined(doc), _id });
    return _id;
  };
  const locate = (id: string) => {
    const table = tables[id.split(":")[0]];
    return { table, index: table.findIndex((d) => d._id === id) };
  };
  for (const [table, docs] of Object.entries(seed)) for (const d of docs) insert(table, d);

  const db = {
    query(table: string) {
      const filters: [string, unknown][] = [];
      const q = {
        withIndex(_name: string, build: (b: IndexRange) => unknown) {
          const b: IndexRange = { eq: (f, x) => (filters.push([f, x]), b) };
          build(b);
          return q;
        },
        async collect() {
          return tables[table].filter((d) => filters.every(([f, x]) => d[f] === x)).map((d) => ({ ...d }));
        },
        async first() {
          return (await q.collect())[0] ?? null;
        },
      };
      return q;
    },
    async insert(table: string, doc: Record<string, unknown>) {
      return insert(table, doc);
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const { table, index } = locate(id);
      const doc: Doc = { ...table[index], ...patch };
      for (const [k, x] of Object.entries(patch)) if (x === undefined) delete doc[k];
      table[index] = doc;
    },
    async delete(id: string) {
      const { table, index } = locate(id);
      table.splice(index, 1);
    },
  };
  return { ctx: { db } as unknown as MutationCtx, tables };
}

function workout(id: string, start: string, durationS: number, distanceKm: number, type = "Running"): AppleWorkout {
  const r = parseAppleWorkout({ id, type, start, durationS, distanceKm });
  if (!r.ok) throw new Error(r.error);
  return r.workout;
}

const DATE = "2026-10-28";
const warmup = workout("wu", `${DATE}T06:30:00-04:00`, 720, 2); // 6:00/km
const main = workout("tempo", `${DATE}T06:45:00-04:00`, 1620, 6); // 4:30/km
const cooldown = workout("cd", `${DATE}T07:15:00-04:00`, 660, 1.8); // ~6:07/km

function seedTempoDay() {
  return fakeCtx({
    trainingPlan: [{ name: "Plan", startDate: "2026-09-07", raceDate: "2027-05-01", goalTime: 4800, currentPace: "5:00", goalPace: "4:30" }],
    workouts: [
      {
        planId: "trainingPlan:1",
        date: DATE,
        weekNumber: 8,
        dayOfWeek: "Wednesday",
        type: "tempo",
        title: "Tempo 6K",
        description: "6 km at tempo",
        targetDistance: 6,
        targetPace: "4:30/km",
        completed: false,
      },
    ],
  });
}

const rowsOn = (tables: Record<string, Doc[]>) => tables.workouts.filter((w) => w.date === DATE);
const planned = (tables: Record<string, Doc[]>) => rowsOn(tables).find((w) => !w.isUnplanned)!;
const byActivity = (tables: Record<string, Doc[]>, id: string) => rowsOn(tables).find((w) => w.stravaActivityId === id)!;

describe("ingestAppleWorkout", () => {
  it("rematches the day when segments arrive one at a time, like a Strava batch", async () => {
    const { ctx, tables } = seedTempoDay();

    await ingestAppleWorkout(ctx, warmup);
    // Alone, the warmup is the best (only) fit for the tempo.
    expect(planned(tables).stravaActivityId).toBe(warmup.activityId);

    const result = await ingestAppleWorkout(ctx, main);
    expect(result).toMatchObject({ status: "created", rematched: 2 });
    expect(planned(tables)).toMatchObject({ stravaActivityId: main.activityId, actualDistance: 6, actualDuration: 1620, title: "Tempo 6K" });
    expect(byActivity(tables, warmup.activityId)).toMatchObject({ isUnplanned: true, title: "Warmup — Tempo 6K", actualDistance: 2 });

    await ingestAppleWorkout(ctx, cooldown);
    expect(rowsOn(tables)).toHaveLength(3);
    expect(planned(tables).stravaActivityId).toBe(main.activityId);
    expect(byActivity(tables, cooldown.activityId).title).toBe("Cooldown — Tempo 6K");

    // Every detail points at the row its activity ended up on.
    for (const d of tables.activityDetails) {
      expect(d.workoutId).toBe(byActivity(tables, d.activityId as string)._id);
    }
  });

  it("matches the same however the segments are ordered", async () => {
    const { ctx, tables } = seedTempoDay();
    for (const w of [cooldown, main, warmup]) await ingestAppleWorkout(ctx, w);
    expect(rowsOn(tables)).toHaveLength(3);
    expect(planned(tables).stravaActivityId).toBe(main.activityId);
    expect(byActivity(tables, warmup.activityId).title).toBe("Warmup — Tempo 6K");
    expect(byActivity(tables, cooldown.activityId).title).toBe("Cooldown — Tempo 6K");
  });

  it("gives the planned row back when a cross-training session took it first", async () => {
    const { ctx, tables } = seedTempoDay();
    await ingestAppleWorkout(ctx, workout("lift", `${DATE}T05:30:00-04:00`, 1800, 0, "Traditional Strength Training"));
    expect(planned(tables)).toMatchObject({ type: "cross_training", originalType: "tempo" });

    await ingestAppleWorkout(ctx, main);
    expect(planned(tables)).toMatchObject({ type: "tempo", title: "Tempo 6K", stravaActivityId: main.activityId });
    expect(planned(tables).originalType).toBeUndefined();
    expect(planned(tables).notes).toBeUndefined();
    expect(byActivity(tables, "ah:lift")).toMatchObject({ isUnplanned: true, type: "cross_training" });
  });

  it("leaves a resent workout alone", async () => {
    const { ctx, tables } = seedTempoDay();
    await ingestAppleWorkout(ctx, main);
    const before = JSON.stringify(tables);
    expect(await ingestAppleWorkout(ctx, main)).toMatchObject({ status: "duplicate" });
    expect(JSON.stringify(tables)).toBe(before);
  });
});
