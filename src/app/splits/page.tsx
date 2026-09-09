"use client";

import { useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SplitsUploader } from "@/components/splits-uploader";
import { SplitUploadCard } from "@/components/split-upload-card";
import {
  subscribePasscode,
  loadPasscode,
  noPasscode,
  savePasscode,
  clearPasscode,
} from "@/lib/passcode";
import { ListOrdered, Lock } from "lucide-react";

export default function SplitsPage() {
  const passcode = useSyncExternalStore(subscribePasscode, loadPasscode, noPasscode);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);

  const uploads = useQuery(api.splits.listUploads, {});

  const unlock = () => {
    const code = passcodeInput.trim();
    if (!code) return;
    savePasscode(code);
    setPasscodeError(false);
  };

  const handlePasscodeRejected = () => {
    clearPasscode();
    setPasscodeError(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListOrdered className="h-6 w-6" />
          Splits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Strava syncs one average pace per run. Upload your watch&apos;s split table and the
          rep-by-rep detail goes into your training data — and into what the coach reads.
        </p>
      </div>

      {passcode ? (
        <SplitsUploader passcode={passcode} onPasscodeRejected={handlePasscodeRejected} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Enter passcode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Reading a screenshot costs API credit, so it&apos;s behind the same passcode as the
              coach.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlock()}
                placeholder="Passcode"
              />
              <Button onClick={unlock}>Unlock</Button>
            </div>
            {passcodeError && <p className="text-sm text-destructive">Wrong passcode.</p>}
          </CardContent>
        </Card>
      )}

      {uploads === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : uploads.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No splits uploaded yet. Screenshot the segments or splits screen in your watch app and
            add it here — intervals are where it matters most, since the session average pace says
            nothing about the reps.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {uploads.map((upload) => (
            <SplitUploadCard
              key={upload._id}
              upload={upload}
              passcode={passcode ?? ""}
              onPasscodeRejected={handlePasscodeRejected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
