"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { checkPasscode } from "./lib/passcode";
import { MODEL, createMessage } from "./lib/anthropicClient";
import { normalizeSplits, summarizeSplits, type RawSplit } from "./lib/splitParsing";
import { MAX_IMAGE_BYTES } from "./lib/imageUploads";

const SYSTEM_PROMPT = `You transcribe the split/segment table from a screenshot of a running watch or fitness app (Apple Watch, Strava, Garmin, Coros, Nike Run Club and the like) into structured data.

You are a transcriber, not an analyst. Report exactly what the screenshot shows. Never invent, average, smooth or complete a value you cannot read — a missing field is fine, a wrong number is not. Read every row, in the order it appears, including partial final splits.

Units: give every distance in metres. Convert from miles (1 mi = 1609.344 m), kilometres or yards (0.9144 m) as needed, and say in your notes when you converted. Give every duration in seconds: 11:48 is 708, 1:02:30 is 3750. Copy the pace column verbatim into displayed_pace, exactly as printed including its unit — it is used to double-check the distance and time you read, so never retype it from your own arithmetic.

Labelling: classify each row as warmup (the opening steady block before faster work), work (a fast repetition in an interval or tempo session), recovery (a short slow segment between fast reps), cooldown (the closing slow block), steady (an evenly-paced continuous run, where every split is just a split), or unknown when the pattern genuinely isn't clear. Judge from the pattern of distances and paces across the whole table.

If several screenshots are given they are consecutive parts of ONE scrolled list: continue straight through, and if the last rows of one repeat the first rows of the next, transcribe the overlapping rows only once.

If the image is not a split table at all, call the tool with an empty splits list and say what you actually see in the notes.`;

const RECORD_SPLITS_TOOL: Anthropic.Beta.BetaTool = {
  name: "record_splits",
  description: "Record every split row read from the screenshot, in order.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "The app or device the screenshot came from, e.g. 'Apple Watch', 'Strava', 'Garmin'. Omit if it isn't identifiable.",
      },
      splits: {
        type: "array",
        description: "One entry per row in the table, in the order shown.",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "Row number as shown, starting at 1" },
            distance_meters: { type: "number", description: "Distance of this split in metres" },
            duration_seconds: { type: "number", description: "Elapsed time of this split in seconds" },
            displayed_pace: { type: "string", description: "The pace column copied verbatim, e.g. \"7'23\\\"/km\"" },
            heart_rate: { type: "integer", description: "Average heart rate in bpm, if the row shows one" },
            kind: {
              type: "string",
              enum: ["warmup", "work", "recovery", "steady", "cooldown", "unknown"],
              description: "What this split was in the session",
            },
          },
          required: ["index", "distance_meters", "duration_seconds"],
        },
      },
      notes: {
        type: "string",
        description: "Anything worth flagging: unit conversions, a cropped or unreadable row, columns the screenshot doesn't have, or what the image shows if it isn't a split table.",
      },
    },
    required: ["splits"],
  },
};

type ExtractionOutput = { source?: string; splits?: RawSplit[]; notes?: string };

/**
 * Read one upload's screenshots into splits. Every derived number (pace,
 * totals) is computed in normalizeSplits/summarizeSplits, so the model's only
 * job is transcription — the same division of labour as the weekly stats.
 */
export const extractSplits = action({
  args: { passcode: v.string(), uploadId: v.id("splitUploads") },
  handler: async (ctx, args) => {
    checkPasscode(args.passcode);
    const upload = await ctx.runQuery(internal.splits.getUpload, { uploadId: args.uploadId });
    if (!upload) throw new Error("Upload not found");
    await ctx.runMutation(internal.splits.markProcessing, { uploadId: args.uploadId });

    try {
      const images: Anthropic.Beta.BetaImageBlockParam[] = [];
      for (const image of upload.images) {
        const blob = await ctx.storage.get(image.storageId);
        if (!blob) throw new Error("Screenshot is no longer in storage — upload it again");
        const bytes = Buffer.from(await blob.arrayBuffer());
        if (bytes.byteLength > MAX_IMAGE_BYTES) {
          throw new Error(
            `Screenshot is ${(bytes.byteLength / 1_000_000).toFixed(1)} MB — too large to read. Crop it to the splits table and try again.`
          );
        }
        images.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            data: bytes.toString("base64"),
          },
        });
      }

      const response = await createMessage(new Anthropic(), {
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        tools: [RECORD_SPLITS_TOOL],
        tool_choice: { type: "tool", name: RECORD_SPLITS_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              ...images,
              {
                type: "text",
                text: `${
                  images.length > 1
                    ? `These ${images.length} screenshots are consecutive parts of one scrolled split table.`
                    : "This screenshot shows the split/segment table of one run."
                } Transcribe every row with record_splits.`,
              },
            ],
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("The reader declined to process this image. Try a different screenshot.");
      }

      const toolUse = response.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock =>
          b.type === "tool_use" && b.name === RECORD_SPLITS_TOOL.name
      );
      const output = (toolUse?.input ?? {}) as ExtractionOutput;
      const splits = normalizeSplits(output.splits ?? []);
      if (splits.length === 0) {
        throw new Error(
          output.notes?.trim()
            ? `No splits found — ${output.notes.trim()}`
            : "No splits could be read from that screenshot. Make sure the distance and time columns are visible."
        );
      }

      const summary = summarizeSplits(splits);
      await ctx.runMutation(internal.splits.saveExtraction, {
        uploadId: args.uploadId,
        source: output.source?.trim() || undefined,
        splits,
        totalDistanceMeters: summary.totalDistanceMeters,
        totalDurationSeconds: summary.totalDurationSeconds,
        extractionNotes: output.notes?.trim() || undefined,
      });
      return { splitCount: splits.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.splits.failExtraction, {
        uploadId: args.uploadId,
        error: message,
      });
      throw e;
    }
  },
});
