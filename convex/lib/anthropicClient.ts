"use node";

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";
const BETAS = ["server-side-fallback-2026-07-01"];

/**
 * Anthropic errors arrive as a JSON blob inside the message. Surface the part
 * that tells the user what to actually do about it.
 */
export function friendlyApiError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) {
    return new Error("Anthropic rejected the API key. Check ANTHROPIC_API_KEY in the Convex deployment (npx convex env list).");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new Error("Anthropic rate limit hit — wait a moment and try again.");
  }
  if (e instanceof Anthropic.APIError) {
    const detail = typeof e.message === "string" ? e.message : String(e);
    if (/credit balance|billing|quota/i.test(detail)) {
      return new Error("Anthropic account has no API credits. Add credits at console.anthropic.com under Billing — a Claude.ai subscription does not cover API usage.");
    }
    return new Error(`Anthropic API error ${e.status}: ${detail}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Server-side refusal fallbacks are opt-in per account. If the beta isn't
 * enabled the request 400s on the parameter itself, so retry once without it
 * rather than failing the whole call.
 */
export async function createMessage(
  client: Anthropic,
  params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "betas" | "fallbacks">
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await client.beta.messages.create({ ...params, betas: BETAS, fallbacks: "default" });
  } catch (e) {
    const isFallbackRejection =
      e instanceof Anthropic.APIError &&
      e.status === 400 &&
      /fallback|beta/i.test(String(e.message));
    if (!isFallbackRejection) throw friendlyApiError(e);
    try {
      return await client.beta.messages.create(params);
    } catch (retryError) {
      throw friendlyApiError(retryError);
    }
  }
}

export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
