import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listTests = query({
  handler: async (ctx) => {
    const tests = await ctx.db.query("vo2maxTests").collect();
    return tests.sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * Tests are rare, so they're recorded from the CLI rather than a form:
 * `npx convex run vo2max:recordTest '{"date":"…","vo2max":…}'`.
 * One test per date — re-running for the same date corrects it.
 */
export const recordTest = internalMutation({
  args: {
    date: v.string(),
    vo2max: v.number(),
    peakVo2: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    weightLbs: v.optional(v.number()),
    percentile: v.optional(v.number()),
    lab: v.optional(v.string()),
    protocol: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vo2maxTests")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, args);
      return `Updated VO2max test on ${args.date}: ${args.vo2max}`;
    }
    await ctx.db.insert("vo2maxTests", args);
    return `Recorded VO2max test on ${args.date}: ${args.vo2max}`;
  },
});
