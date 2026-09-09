/**
 * Limits shared by the browser (which checks before uploading) and the
 * server (which checks again before spending an API call).
 */

/** Anthropic rejects images past ~5 MB of base64; stop well short of it. */
export const MAX_IMAGE_BYTES = 4_000_000;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export function isAllowedImageType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}
