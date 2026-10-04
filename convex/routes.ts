import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getStravaAccessToken, stravaFailure } from "./strava";

/**
 * Route geometry for the run-overlay art. Strava's activity list carries a
 * `summary_polyline` per activity, so one list call per month is enough —
 * no per-activity detail fetches.
 */

const routeFields = {
  stravaId: v.string(),
  name: v.string(),
  type: v.string(),
  date: v.string(),
  startTime: v.string(),
  distance: v.number(),
  duration: v.number(),
  polyline: v.string(),
  startLat: v.optional(v.number()),
  startLng: v.optional(v.number()),
};

export const upsertRoutes = internalMutation({
  args: { routes: v.array(v.object(routeFields)) },
  handler: async (ctx, { routes }) => {
    let inserted = 0;
    for (const route of routes) {
      const existing = await ctx.db
        .query("activityRoutes")
        .withIndex("by_strava_id", (q) => q.eq("stravaId", route.stravaId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, route);
      } else {
        await ctx.db.insert("activityRoutes", route);
        inserted++;
      }
    }
    return { inserted, total: routes.length };
  },
});

/** Pull every GPS-bearing activity between two local dates (inclusive). */
export const syncRoutes = action({
  args: { start: v.string(), end: v.string() }, // YYYY-MM-DD
  handler: async (ctx, { start, end }): Promise<{ inserted: number; total: number }> => {
    const accessToken = await getStravaAccessToken(ctx);
    // Pad a day each side: `after`/`before` are UTC, dates are local.
    const after = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000) - 86400;
    const before = Math.floor(Date.parse(`${end}T00:00:00Z`) / 1000) + 2 * 86400;

    type Raw = {
      id: number;
      name: string;
      type: string;
      distance: number;
      moving_time: number;
      start_date_local: string;
      start_latlng?: [number, number] | [];
      map?: { summary_polyline?: string | null };
    };
    const raws: Raw[] = [];
    const perPage = 200;
    for (let page = 1; page <= 5; page++) {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=${perPage}&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        throw new Error(await stravaFailure(response));
      }
      const batch: Raw[] = await response.json();
      raws.push(...batch);
      if (batch.length < perPage) break;
    }

    const routes = raws
      .filter((a) => a.map?.summary_polyline)
      .map((a) => ({
        stravaId: String(a.id),
        name: a.name,
        type: a.type,
        date: a.start_date_local.split("T")[0],
        startTime: a.start_date_local,
        distance: Math.round((a.distance / 1000) * 100) / 100,
        duration: a.moving_time,
        polyline: a.map!.summary_polyline!,
        startLat: a.start_latlng?.[0],
        startLng: a.start_latlng?.[1],
      }))
      .filter((r) => r.date >= start && r.date <= end);

    return await ctx.runMutation(internal.routes.upsertRoutes, { routes });
  },
});

export const routesInRange = query({
  args: { start: v.string(), end: v.string() },
  handler: async (ctx, { start, end }) => {
    const rows = await ctx.db
      .query("activityRoutes")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", end))
      .collect();
    return rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
});
