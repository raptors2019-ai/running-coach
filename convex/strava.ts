import { query, action, internalMutation, internalQuery, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { mapStravaTypeToWorkoutType, workoutTitleForType } from "./lib/stravaMapping";

export const getStravaAuth = query({
  handler: async (ctx) => {
    return await ctx.db.query("stravaAuth").first();
  },
});

export const saveStravaAuth = internalMutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    athleteId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("stravaAuth").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("stravaAuth", args);
    }
  },
});

export const exchangeStravaCode = action({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Strava credentials not configured");
    }

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: args.code,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange Strava code");
    }

    const data = await response.json();

    await ctx.runMutation(internal.strava.saveStravaAuth, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId: String(data.athlete.id),
    });

    return { success: true };
  },
});

export interface StravaActivity {
  stravaId: string;
  name: string;
  type: string;
  distance: number;
  duration: number;
  date: string;
  avgHeartRate?: number;
}

async function fetchStravaActivities(ctx: ActionCtx): Promise<StravaActivity[]> {
  const auth = await ctx.runQuery(internal.strava.getStravaAuthInternal);
  if (!auth) {
    throw new Error("Not connected to Strava");
  }

  let accessToken: string = auth.accessToken;

  if (auth.expiresAt < Date.now() / 1000) {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    const refreshResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: auth.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh Strava token");
    }

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;

    await ctx.runMutation(internal.strava.saveStravaAuth, {
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token,
      expiresAt: refreshData.expires_at,
      athleteId: auth.athleteId,
    });
  }

  const after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const response: Response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Strava activities");
  }

  const activities: Array<{
    type: string;
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    start_date_local: string;
    average_heartrate?: number;
  }> = await response.json();

  return activities.map((a) => ({
    stravaId: String(a.id),
    name: a.name,
    type: a.type,
    distance: Math.round((a.distance / 1000) * 100) / 100,
    duration: a.moving_time,
    date: a.start_date_local.split("T")[0],
    avgHeartRate: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
  }));
}

export const syncStravaActivities = action({
  handler: async (ctx): Promise<StravaActivity[]> => {
    return await fetchStravaActivities(ctx);
  },
});

export const syncAndAutoMatch = action({
  handler: async (ctx): Promise<{ synced: number; autoCompleted: number; alreadyDone: number }> => {
    const activities = await fetchStravaActivities(ctx);

    const mappedActivities = activities.map((activity) => {
      const mappedType = mapStravaTypeToWorkoutType(activity.type, activity.name);
      const mappedTitle = workoutTitleForType(mappedType);
      return {
        date: activity.date,
        stravaActivityId: activity.stravaId,
        actualDistance: activity.distance,
        actualDuration: activity.duration,
        avgHeartRate: activity.avgHeartRate,
        mappedType,
        mappedTitle,
        activityName: activity.name,
      };
    });

    const result = await ctx.runMutation(internal.workouts.autoCompleteFromActivities, {
      activities: mappedActivities,
    });

    await ctx.runMutation(internal.strava.updateLastSyncAt);

    return { synced: activities.length, ...result };
  },
});

export const getStravaAuthInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("stravaAuth").first();
  },
});

export const getLastSyncTime = query({
  handler: async (ctx) => {
    const auth = await ctx.db.query("stravaAuth").first();
    return auth?.lastSyncAt ?? null;
  },
});

export const updateLastSyncAt = internalMutation({
  handler: async (ctx) => {
    const auth = await ctx.db.query("stravaAuth").first();
    if (auth) {
      await ctx.db.patch(auth._id, { lastSyncAt: Date.now() });
    }
  },
});
