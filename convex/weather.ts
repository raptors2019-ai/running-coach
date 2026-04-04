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
