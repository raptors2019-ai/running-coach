"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Sunrise, Lock, ChevronDown } from "lucide-react";
import { getLocalDateString } from "@/lib/pace-utils";

const PASSCODE_KEY = "coach_passcode";

/**
 * Convex wraps action errors with a stack trace and framework noise. Pull out
 * the first meaningful line so the UI shows the real cause (bad key, no
 * credits, rate limit) instead of a generic guess.
 */
function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cleaned = e.message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("at ") && !l.startsWith("Called by"))
    .join(" ");
  return cleaned || e.message;
}

function loadPasscode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

export default function CoachPage() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [showPastBriefings, setShowPastBriefings] = useState(false);

  const briefings = useQuery(api.coach.getBriefings);
  const messages = useQuery(api.coach.getMessages);
  const sendMessage = useAction(api.coachActions.sendMessage);
  const generateBriefing = useAction(api.coachActions.generateBriefingNow);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPasscode(loadPasscode());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, sending]);

  const today = getLocalDateString();
  const todaysBriefing = briefings?.find((b) => b.date === today);
  const pastBriefings = briefings?.filter((b) => b.date !== today) ?? [];

  const unlock = () => {
    const code = passcodeInput.trim();
    if (!code) return;
    try {
      localStorage.setItem(PASSCODE_KEY, code);
    } catch {
      // Private mode — proceed for this visit only
    }
    setPasscode(code);
    setPasscodeError(false);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !passcode || sending) return;
    setDraft("");
    setSending(true);
    try {
      await sendMessage({ passcode, text });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Wrong passcode")) {
        setPasscode(null);
        setPasscodeError(true);
        try {
          localStorage.removeItem(PASSCODE_KEY);
        } catch {}
      } else {
        alert(`Coach didn't answer.\n\n${describeError(e)}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (!passcode || briefingLoading) return;
    setBriefingLoading(true);
    try {
      await generateBriefing({ passcode });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Wrong passcode")) {
        setPasscode(null);
        setPasscodeError(true);
      } else {
        alert(`Couldn't generate the briefing.\n\n${describeError(e)}`);
      }
    } finally {
      setBriefingLoading(false);
    }
  };

  if (passcode === null) {
    return (
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Coach Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the coach passcode. You only need to do this once on this device.
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
            {passcodeError && (
              <p className="text-sm text-red-600">Wrong passcode — try again.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-40 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold">Coach</h1>
      </div>

      {/* Morning briefing */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-amber-600" />
            {todaysBriefing ? "Today's Briefing" : "Morning Briefing"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysBriefing ? (
            <p className="text-sm whitespace-pre-wrap">{todaysBriefing.content}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No briefing yet today. The coach writes one automatically every morning at 6 AM.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateBriefing}
                disabled={briefingLoading}
              >
                {briefingLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sunrise className="h-4 w-4 mr-1" />
                )}
                Generate now
              </Button>
            </div>
          )}

          {pastBriefings.length > 0 && (
            <div>
              <button
                className="text-xs text-muted-foreground flex items-center gap-1"
                onClick={() => setShowPastBriefings(!showPastBriefings)}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showPastBriefings ? "rotate-180" : ""}`}
                />
                Past briefings ({pastBriefings.length})
              </button>
              {showPastBriefings && (
                <div className="mt-2 space-y-3">
                  {pastBriefings.map((b) => (
                    <div key={b._id} className="border-l-2 border-amber-200 pl-3">
                      <div className="text-xs font-medium text-muted-foreground">{b.date}</div>
                      <p className="text-sm whitespace-pre-wrap">{b.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat */}
      <div className="space-y-3">
        {messages?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Talk to your coach — ask about training, report how a run felt, or tell it
            about schedule changes and it will adjust the plan for you.
          </p>
        )}
        {messages?.map((m) => (
          <div key={m._id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="fixed bottom-14 left-0 right-0 bg-background border-t p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Message your coach..."
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
