"use client";

/**
 * Catches errors thrown above the segment boundaries — e.g. the
 * ConvexReactClient constructor in the root layout's provider throwing when
 * NEXT_PUBLIC_CONVEX_URL is missing. Replaces the root layout entirely, so it
 * must render its own <html>/<body> and can't rely on global CSS.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 640,
          margin: "0 auto",
          padding: 16,
        }}
      >
        <h1 style={{ fontSize: 18, marginTop: 48 }}>The app hit an error</h1>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#f4f4f5",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
          }}
        >
          {error.message || String(error)}
        </pre>
        <button
          onClick={reset}
          style={{
            border: "1px solid #d4d4d8",
            borderRadius: 8,
            padding: "6px 12px",
            background: "white",
            fontSize: 14,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
