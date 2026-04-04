import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const getCachedWeather = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weatherCache")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
  },
});

export const saveWeather = internalMutation({
  args: {
    date: v.string(),
    temperature: v.number(),
    feelsLike: v.number(),
    humidity: v.number(),
    windSpeed: v.number(),
    condition: v.string(),
    icon: v.string(),
    precipitation: v.number(),
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weatherCache")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("weatherCache", args);
    }
  },
});

export const saveForecastDay = internalMutation({
  args: {
    date: v.string(),
    temperature: v.number(),
    feelsLike: v.number(),
    humidity: v.number(),
    windSpeed: v.number(),
    condition: v.string(),
    icon: v.string(),
    precipitation: v.number(),
    fetchedAt: v.number(),
    temperatureAm: v.optional(v.number()),
    temperaturePm: v.optional(v.number()),
    conditionAm: v.optional(v.string()),
    conditionPm: v.optional(v.string()),
    precipitationAm: v.optional(v.number()),
    precipitationPm: v.optional(v.number()),
    windSpeedAm: v.optional(v.number()),
    windSpeedPm: v.optional(v.number()),
    isForecast: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weatherCache")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("weatherCache", args);
    }
  },
});

export const getForecast = query({
  args: { startDate: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("weatherCache").collect();
    return all.filter(
      (w) => w.date >= args.startDate && w.isForecast === true
    );
  },
});

export const fetchForecast = action({
  handler: async (ctx) => {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.log("No OpenWeatherMap API key configured");
      return null;
    }

    const lat = 43.589;
    const lon = -79.644;
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error("Forecast API error:", response.status);
      return null;
    }

    const data = await response.json();
    const blocks = data.list as Array<{
      dt: number;
      main: { temp: number; feels_like: number; humidity: number };
      weather: Array<{ main: string; icon: string }>;
      wind: { speed: number };
      rain?: { "3h"?: number };
      snow?: { "3h"?: number };
    }>;

    // Group blocks by local date and find AM (6am) / PM (6pm) blocks
    const dayMap = new Map<string, typeof blocks>();
    for (const block of blocks) {
      const localDate = new Date(block.dt * 1000).toLocaleDateString("en-CA", {
        timeZone: "America/Toronto",
      });
      const group = dayMap.get(localDate) || [];
      group.push(block);
      dayMap.set(localDate, group);
    }

    const fetchedAt = Date.now();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

    for (const [date, dayBlocks] of dayMap) {
      // Skip today — don't overwrite the live weather widget data
      if (date === today) continue;
      // Find blocks closest to 6am and 6pm local time
      const getClosestBlock = (targetHour: number) => {
        let closest = dayBlocks[0];
        let minDiff = Infinity;
        for (const block of dayBlocks) {
          const localHour = parseInt(
            new Date(block.dt * 1000).toLocaleString("en-CA", {
              timeZone: "America/Toronto",
              hour: "numeric",
              hour12: false,
            })
          );
          const diff = Math.abs(localHour - targetHour);
          if (diff < minDiff) {
            minDiff = diff;
            closest = block;
          }
        }
        return closest;
      };

      const amBlock = getClosestBlock(6);
      const pmBlock = getClosestBlock(18);
      // Use midday block for overall values
      const midBlock = getClosestBlock(12);

      await ctx.runMutation(internal.weather.saveForecastDay, {
        date,
        temperature: Math.round(midBlock.main.temp),
        feelsLike: Math.round(midBlock.main.feels_like),
        humidity: midBlock.main.humidity,
        windSpeed: Math.round(midBlock.wind.speed * 3.6),
        condition: midBlock.weather[0].main,
        icon: midBlock.weather[0].icon,
        precipitation: midBlock.rain?.["3h"] || midBlock.snow?.["3h"] || 0,
        fetchedAt,
        temperatureAm: Math.round(amBlock.main.temp),
        temperaturePm: Math.round(pmBlock.main.temp),
        conditionAm: amBlock.weather[0].main,
        conditionPm: pmBlock.weather[0].main,
        precipitationAm: amBlock.rain?.["3h"] || amBlock.snow?.["3h"] || 0,
        precipitationPm: pmBlock.rain?.["3h"] || pmBlock.snow?.["3h"] || 0,
        windSpeedAm: Math.round(amBlock.wind.speed * 3.6),
        windSpeedPm: Math.round(pmBlock.wind.speed * 3.6),
        isForecast: true,
      });
    }

    return { days: dayMap.size };
  },
});

export const fetchWeather = action({
  handler: async (ctx) => {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.log("No OpenWeatherMap API key configured");
      return null;
    }

    const lat = 43.589;
    const lon = -79.644;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error("Weather API error:", response.status);
      return null;
    }

    const data = await response.json();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

    const weather = {
      date: today,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      condition: data.weather[0].main,
      icon: data.weather[0].icon,
      precipitation: data.rain?.["1h"] || data.snow?.["1h"] || 0,
      fetchedAt: Date.now(),
    };

    await ctx.runMutation(internal.weather.saveWeather, weather);
    return weather;
  },
});
