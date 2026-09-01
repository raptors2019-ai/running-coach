"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Segment error boundary — catches anything thrown during render, including
 * Convex query failures surfaced through useQuery (e.g. the frontend calling
 * a function the deployed backend doesn't have yet). Without this, any such
 * error white-screens the page with Next's generic "Application error" and no
 * way to see the cause. The bottom nav lives in the layout, so navigation to
 * other tabs keeps working.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <Card className="mt-12 border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            This page hit an error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
