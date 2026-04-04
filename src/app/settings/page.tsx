"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PACE_ZONES, GOAL_PACE, CURRENT_PACE, RACE_DATE } from "@/lib/constants";
import { Link2, RefreshCw, Database, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const stravaAuth = useQuery(api.strava.getStravaAuth);
  const plan = useQuery(api.workouts.getTrainingPlan);
  const seedPlan = useMutation(api.seed.seedTrainingPlan);
  const syncStrava = useAction(api.strava.syncAndAutoMatch);
  const fetchWeather = useAction(api.weather.fetchWeather);

  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedPlan();
    } finally {
      setSeeding(false);
    }
  };

  const handleStravaConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId) {
      alert("Strava Client ID not configured. Set NEXT_PUBLIC_STRAVA_CLIENT_ID in .env.local");
      return;
    }
    const redirectUri = `${window.location.origin}/api/strava/callback`;
    const scope = "activity:read_all";
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncStrava();
      alert(`Synced ${result.synced} activities. ${result.autoCompleted} auto-completed, ${result.newActivitiesCreated} new activities created, ${result.alreadyDone} already done.`);
    } catch {
      alert("Failed to sync. Check Strava connection.");
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchWeather = async () => {
    setFetchingWeather(true);
    try {
      await fetchWeather();
    } finally {
      setFetchingWeather(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {plan ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Race Date</span>
                <span>{RACE_DATE}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Pace</span>
                <span>{CURRENT_PACE}/km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goal Pace</span>
                <span>{GOAL_PACE}/km</span>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-muted-foreground mb-3">No plan loaded yet</p>
              <Button onClick={handleSeed} disabled={seeding}>
                {seeding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Database className="h-4 w-4 mr-1" />
                Load Training Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pace Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace Zones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PACE_ZONES.map((zone) => (
            <div key={zone.name} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${zone.color}`} />
              <span className="flex-1">{zone.name}</span>
              <span className="text-muted-foreground">
                {zone.minPace} - {zone.maxPace}/km
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Strava */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Strava Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stravaAuth ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Link2 className="h-4 w-4" />
                Connected (Athlete #{stravaAuth.athleteId})
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync Activities
              </Button>
            </>
          ) : (
            <Button onClick={handleStravaConnect}>
              <Link2 className="h-4 w-4 mr-1" />
              Connect Strava
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Weather */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weather</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchWeather}
            disabled={fetchingWeather}
          >
            {fetchingWeather ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh Weather
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Mississauga, ON (43.589, -79.644)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
