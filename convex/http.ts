import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseAppleWorkout, secretsMatch } from "./lib/appleHealth";

const http = httpRouter();

// Bodies are one workout; a few thousand HR samples and a route fit easily.
const MAX_BODY_BYTES = 2_000_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Apple Health workouts pushed by the iPhone Shortcut
 * (docs/apple-health-shortcut.md). Never logs the secret or the payload:
 * the body carries heart rate and location.
 */
http.route({
  path: "/apple-health/workout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!secretsMatch(request.headers.get("X-Ingest-Secret"), process.env.APPLE_INGEST_SECRET)) {
      return json(401, { error: "unauthorized" });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: "payload too large" });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: "body is not valid JSON" });
    }

    const parsed = parseAppleWorkout(body);
    if (!parsed.ok) return json(400, { error: parsed.error });

    const result = await ctx.runMutation(internal.appleHealth.ingestWorkout, { workout: parsed.workout });
    return json(200, { ...result, activityId: parsed.workout.activityId, date: parsed.workout.date });
  }),
});

export default http;
