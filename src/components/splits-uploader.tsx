"use client";

import { useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getLocalDateString } from "@/lib/pace-utils";
import { describeError } from "@/lib/passcode";
import { MAX_IMAGE_BYTES, isAllowedImageType } from "../../convex/lib/imageUploads";

/**
 * Screenshot in, splits out. Several screenshots of one scrolled list count
 * as one upload, so a long run's splits stay a single session rather than
 * arriving as unrelated fragments.
 */
export function SplitsUploader({
  passcode,
  onPasscodeRejected,
}: {
  passcode: string;
  onPasscodeRejected: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [date, setDate] = useState(getLocalDateString());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.splits.generateUploadUrl);
  const createUpload = useMutation(api.splits.createUpload);
  const extractSplits = useAction(api.splitsActions.extractSplits);

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const accepted: File[] = [];
    for (const file of Array.from(selected)) {
      if (!isAllowedImageType(file.type)) {
        setError(`${file.name} isn't a PNG, JPEG, WebP or GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(
          `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB — too big to read. Crop it to the splits table.`
        );
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setError(null);
    setFiles((current) => [...current, ...accepted]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeFile = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(files.length > 1 ? `Uploading ${files.length} screenshots…` : "Uploading screenshot…");
      const images: { storageId: Id<"_storage">; mimeType: string }[] = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl({ passcode });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        images.push({ storageId, mimeType: file.type });
      }

      const uploadId = await createUpload({ passcode, date, images, note });
      setFiles([]);
      setNote("");
      setStatus("Reading the splits…");
      await extractSplits({ passcode, uploadId });
      setStatus(null);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Wrong passcode")) {
        onPasscodeRejected();
      } else {
        setError(describeError(e));
      }
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-1">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        <Button
          type="button"
          variant="outline"
          className="w-full h-20 border-dashed"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <ImagePlus className="h-5 w-5 mr-2" />
          {files.length === 0 ? "Choose screenshot" : "Add another screenshot"}
        </Button>

        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between gap-2 text-sm bg-muted rounded-md px-2 py-1.5"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={busy}
                  aria-label={`Remove ${file.name}`}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Read as one scrolled list, in the order shown above.
          </p>
        )}

        <div className="space-y-1">
          <Label htmlFor="split-date" className="text-xs">
            Date of run
          </Label>
          <Input
            id="split-date"
            type="date"
            className="max-w-[12rem]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="split-note" className="text-xs">
            Note for your coach (optional)
          </Label>
          <Textarea
            id="split-note"
            rows={2}
            placeholder="How the session actually felt — the reps, the legs, the recoveries."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" onClick={handleSubmit} disabled={busy || files.length === 0}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {status ?? "Working…"}
            </>
          ) : (
            "Read splits"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
