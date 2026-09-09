import { query, mutation, internalQuery, internalMutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { checkPasscode } from "./lib/passcode";
import { isAllowedImageType } from "./lib/imageUploads";
import {
  splitValidator,
  formatSplitsReport,
  splitsForPrompt,
  workRepsSummary,
} from "./lib/splitParsing";

/**
 * Which workout a screenshot belongs to. A completed run on the date is the
 * best answer; failing that the planned row, so an upload made before the
 * Strava sync lands still attaches to the right session.
 */
async function workoutForDate(ctx: QueryCtx, date: string): Promise<Id<"workouts"> | undefined> {
  const onDate = await ctx.db
    .query("workouts")
    .withIndex("by_date", (q) => q.eq("date", date))
    .collect();
  if (onDate.length === 0) return undefined;
  const completed = onDate.find((w) => w.completed && !w.isUnplanned);
  const planned = onDate.find((w) => !w.isUnplanned);
  return (completed ?? planned ?? onDate[0])._id;
}

export const generateUploadUrl = mutation({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createUpload = mutation({
  args: {
    passcode: v.string(),
    date: v.string(),
    images: v.array(v.object({ storageId: v.id("_storage"), mimeType: v.string() })),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    if (args.images.length === 0) throw new Error("No screenshot uploaded");
    for (const image of args.images) {
      if (!isAllowedImageType(image.mimeType)) {
        throw new Error(`Unsupported image type ${image.mimeType} — use PNG, JPEG, WebP or GIF`);
      }
    }
    return await ctx.db.insert("splitUploads", {
      date: args.date,
      workoutId: await workoutForDate(ctx, args.date),
      images: args.images,
      status: "processing",
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const getUpload = internalQuery({
  args: { uploadId: v.id("splitUploads") },
  handler: async (ctx, args) => await ctx.db.get(args.uploadId),
});

export const saveExtraction = internalMutation({
  args: {
    uploadId: v.id("splitUploads"),
    source: v.optional(v.string()),
    splits: v.array(splitValidator),
    totalDistanceMeters: v.number(),
    totalDurationSeconds: v.number(),
    extractionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { uploadId, ...fields } = args;
    await ctx.db.patch(uploadId, { ...fields, status: "ready", error: undefined });
  },
});

export const failExtraction = internalMutation({
  args: { uploadId: v.id("splitUploads"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { status: "failed", error: args.error });
  },
});

/** Mark a stuck upload for retry, so the UI shows progress on a re-run. */
export const markProcessing = internalMutation({
  args: { uploadId: v.id("splitUploads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { status: "processing", error: undefined });
  },
});

export const setUploadNote = mutation({
  args: { passcode: v.string(), uploadId: v.id("splitUploads"), note: v.string() },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    await ctx.db.patch(args.uploadId, { note: args.note.trim() || undefined });
  },
});

export const deleteUpload = mutation({
  args: { passcode: v.string(), uploadId: v.id("splitUploads") },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;
    for (const image of upload.images) {
      await ctx.storage.delete(image.storageId).catch(() => {
        // Already gone — the row still goes.
      });
    }
    await ctx.db.delete(args.uploadId);
  },
});

/** An upload with its image URLs and the shareable text resolved for the UI. */
async function withUrls(ctx: QueryCtx, upload: Doc<"splitUploads">) {
  const imageUrls = (
    await Promise.all(upload.images.map((i) => ctx.storage.getUrl(i.storageId)))
  ).filter((url): url is string => url !== null);
  const splits = upload.splits ?? [];
  const workout = upload.workoutId ? await ctx.db.get(upload.workoutId) : null;
  return {
    ...upload,
    imageUrls,
    workoutTitle: workout?.title ?? null,
    report: splits.length > 0 ? formatSplitsReport({ ...upload, splits }) : null,
    workReps: workRepsSummary(splits),
  };
}

export const listUploads = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const uploads = await ctx.db.query("splitUploads").collect();
    const recent = uploads
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 30);
    return await Promise.all(recent.map((u) => withUrls(ctx, u)));
  },
});

export const getUploadsForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const uploads = await ctx.db
      .query("splitUploads")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    return await Promise.all(
      uploads.sort((a, b) => a.createdAt - b.createdAt).map((u) => withUrls(ctx, u))
    );
  },
});

export const getSplitsInRange = internalQuery({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const uploads = await ctx.db.query("splitUploads").collect();
    return uploads
      .filter((u) => u.status === "ready" && u.date >= args.startDate && u.date <= args.endDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(splitsForPrompt);
  },
});
