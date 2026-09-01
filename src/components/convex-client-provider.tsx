"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

/**
 * NEXT_PUBLIC_CONVEX_URL is baked in at build time, and Vercel Preview is the
 * environment that historically lacks it (see .env.example). Constructing the
 * client at module scope made that misconfiguration a hard prerender crash
 * that failed the whole deployment; instead, build fine and show exactly
 * what's missing at runtime — same philosophy as StalePlanBanner.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convex = useMemo(() => (url ? new ConvexReactClient(url) : null), [url]);

  if (!convex) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">App not configured for this environment</p>
          <p className="mt-1 text-amber-900/80">
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_CONVEX_URL</code> is not
            set. On Vercel, add it under Settings → Environment Variables for this
            environment (Preview deploys need it too); locally, populate{" "}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> via{" "}
            <code className="bg-amber-100 px-1 rounded">npx convex dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
