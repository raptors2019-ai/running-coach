"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WeekStatsGrid } from "@/components/week-stats-grid";
import { WeekAheadCard } from "@/components/week-ahead-card";
import {
  Bot,
  Send,
  Loader2,
  Sunrise,
  Lock,
  ChevronDown,
  CalendarRange,
  RefreshCw,
  History,
} from "lucide-react";
import { getLocalDateString, formatDistance } from "@/lib/pace-utils";
import {
  subscribePasscode,
  loadPasscode,
  noPasscode,
  savePasscode,
  clearPasscode,
  describeError,
  isWrongPasscode,
} from "@/lib/passcode";
import { format, parseISO, addDays } from "date-fns";

function weekLabel(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

export default function CoachPage() {
  const passcode = useSyncExternalStore(subscribePasscode, loadPasscode, noPasscode);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showPastBriefings, setShowPastBriefings] = useState(false);
  const [tab, setTab] = useState("daily");

  const briefings = useQuery(api.coach.getBriefings);
  const messages = useQuery(api.coach.getMessages);
  const overview = useQuery(api.coach.getWeeklyOverview);
  const weeklyReviews = useQuery(api.coach.getWeeklyReviews);
  const sendMessage = useAction(api.coachActions.sendMessage);
  const generateBriefing = useAction(api.coachActions.generateBriefingNow);
  const generateReview = useAction(api.coachActions.generateWeeklyReviewNow);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === "daily") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, sending, tab]);

  const today = getLocalDateString();
  const todaysBriefing = briefings?.find((b) => b.date === today);
  const pastBriefings = briefings?.filter((b) => b.date !== today) ?? [];
  // "Last week" is the most recent completed Mon-Sun week. Anything dated
  // later than that is a stale review of an in-progress week — hide it.
  const lastWeekReview = weeklyReviews?.find((r) => r.weekStart === overview?.reviewWeekStart);
  const pastReviews = overview
    ? (weeklyReviews?.filter((r) => r.weekStart < overview.reviewWeekStart) ?? [])
    : [];

  const handlePasscodeFailure = (e: unknown, fallback: string) => {
    if (isWrongPasscode(e)) {
      setPasscodeError(true);
      clearPasscode();
    } else {
      alert(`${fallback}\n\n${describeError(e)}`);
    }
  };

  const unlock = () => {
    const code = passcodeInput.trim();
    if (!code) return;
    savePasscode(code);
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
      handlePasscodeFailure(e, "Coach didn't answer.");
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
      handlePasscodeFailure(e, "Couldn't generate the briefing.");
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    if (!passcode || reviewLoading) return;
    setReviewLoading(true);
    try {
      await generateReview({ passcode });
    } catch (e) {
      handlePasscodeFailure(e, "Couldn't generate the weekly review.");
    } finally {
      setReviewLoading(false);
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
    <div className={`p-4 max-w-2xl mx-auto space-y-4 ${tab === "daily" ? "pb-40" : "pb-24"}`}>
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold">Coach</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="daily">
            <Sunrise className="h-4 w-4 mr-1" />
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <CalendarRange className="h-4 w-4 mr-1" />
            Weekly
          </TabsTrigger>
        </TabsList>

        {/* ---------- DAILY ---------- */}
        <TabsContent value="daily" className="space-y-4 mt-2">
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
        </TabsContent>

        {/* ---------- WEEKLY ---------- */}
        <TabsContent value="weekly" className="space-y-4 mt-2">
          {overview ? (
            <WeekAheadCard
              weekStart={overview.weekStart}
              today={overview.today}
              workouts={overview.workouts}
              stats={overview.stats}
              lookahead={lastWeekReview ?? null}
              onGenerate={handleGenerateReview}
              generating={reviewLoading}
            />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Last Week
                </span>
                {overview && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {weekLabel(overview.reviewWeekStart)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lastWeekReview ? (
                <>
                  <WeekStatsGrid stats={lastWeekReview.stats} />
                  {lastWeekReview.stats.longestRunKm > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Longest run: {formatDistance(lastWeekReview.stats.longestRunKm)}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap border-t pt-3">{lastWeekReview.review}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No review of last week yet. The coach writes one every Monday morning.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReview}
                disabled={reviewLoading}
              >
                {reviewLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                {lastWeekReview ? "Refresh review" : "Review now"}
              </Button>
            </CardContent>
          </Card>

          {pastReviews.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Earlier Weeks</h2>
              {pastReviews.map((r) => (
                <Card key={r._id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{weekLabel(r.weekStart)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <WeekStatsGrid stats={r.stats} />
                    <p className="text-sm whitespace-pre-wrap">{r.review}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Week-to-week history builds here as the plan progresses.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Composer — daily tab only */}
      {tab === "daily" && (
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
      )}
    </div>
  );
}
