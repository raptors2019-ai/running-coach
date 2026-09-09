"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SplitsTable } from "./splits-table";
import {
  formatClock,
  formatPace,
  formatSplitDistance,
  summarizeSplits,
} from "../../convex/lib/splitParsing";
import { describeError } from "@/lib/passcode";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";

export type SplitUpload = FunctionReturnType<typeof api.splits.listUploads>[number];

/**
 * Hand the splits to a human coach: the Web Share sheet on a phone (text plus
 * the original screenshots, so they can check the transcription), the
 * clipboard everywhere else.
 */
async function shareUpload(upload: SplitUpload, report: string): Promise<"shared" | "copied"> {
  const title = `Splits — ${upload.date}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const files = await Promise.all(
        upload.imageUrls.map(async (url, i) => {
          const blob = await fetch(url).then((r) => r.blob());
          const extension = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
          return new File([blob], `splits-${upload.date}-${i + 1}.${extension}`, { type: blob.type });
        })
      );
      const payload =
        files.length > 0 && navigator.canShare?.({ files })
          ? { title, text: report, files }
          : { title, text: report };
      await navigator.share(payload);
      return "shared";
    } catch (e) {
      // A cancelled share sheet isn't a failure; anything else falls through
      // to the clipboard so the athlete still gets their splits out.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  await navigator.clipboard.writeText(report);
  return "copied";
}

export function SplitUploadCard({
  upload,
  passcode,
  onPasscodeRejected,
}: {
  upload: SplitUpload;
  passcode: string;
  onPasscodeRejected: () => void;
}) {
  const [busy, setBusy] = useState<"share" | "copy" | "retry" | "delete" | null>(null);
  const [copied, setCopied] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteUpload = useMutation(api.splits.deleteUpload);
  const extractSplits = useAction(api.splitsActions.extractSplits);

  const splits = upload.splits ?? [];
  const summary = summarizeSplits(splits);
  const report = upload.report ?? "";

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof Error && e.message.includes("Wrong passcode")) onPasscodeRejected();
      else setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {format(parseISO(upload.date), "EEEE, MMMM d")}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[upload.workoutTitle, upload.source].filter(Boolean).join(" · ") || "Unmatched session"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              run("delete", async () => {
                await deleteUpload({ passcode, uploadId: upload._id });
              })
            }
            disabled={busy !== null}
            aria-label="Delete upload"
          >
            {busy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {upload.status === "processing" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the screenshot…
          </p>
        )}

        {upload.status === "failed" && (
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{upload.error ?? "Couldn't read that screenshot."}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run("retry", async () => {
                  await extractSplits({ passcode, uploadId: upload._id });
                })
              }
              disabled={busy !== null}
            >
              {busy === "retry" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Try again
            </Button>
          </div>
        )}

        {upload.status === "ready" && splits.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="bg-muted rounded-md px-2 py-1">
                {formatSplitDistance(summary.totalDistanceMeters)}
              </span>
              <span className="bg-muted rounded-md px-2 py-1">
                {formatClock(summary.totalDurationSeconds)}
              </span>
              <span className="bg-muted rounded-md px-2 py-1">
                {formatPace(summary.avgPaceSecondsPerKm)} avg
              </span>
            </div>

            {upload.workReps && (
              <p className="text-sm font-medium text-primary">{upload.workReps}</p>
            )}

            <SplitsTable splits={splits} />

            {upload.extractionNotes && (
              <p className="text-xs text-muted-foreground">{upload.extractionNotes}</p>
            )}

            {upload.note && (
              <p className="text-sm bg-muted rounded-md px-2 py-1.5">{upload.note}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run("share", async () => {
                    const outcome = await shareUpload(upload, report);
                    if (outcome === "copied") {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  })
                }
                disabled={busy !== null}
              >
                {busy === "share" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                Send to coach
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run("copy", async () => {
                    await navigator.clipboard.writeText(report);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
                disabled={busy !== null}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              {upload.imageUrls.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowImages((v) => !v)}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {showImages ? "Hide" : "Screenshot"}
                </Button>
              )}
            </div>
          </>
        )}

        {showImages && (
          <div className="space-y-2">
            {upload.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed and not known at build time
              <img
                key={url}
                src={url}
                alt={`Splits screenshot from ${upload.date}`}
                className="w-full rounded-md border"
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
