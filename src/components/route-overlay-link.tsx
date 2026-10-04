import Link from "next/link";
import { Route } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Entry to the month route overlay from the Progress page. */
export function RouteOverlayLink() {
  return (
    <Link href="/overlay" className="block">
      <Card className="bg-[#0B0B0D] text-white border-0 hover:bg-[#161417] transition-colors">
        <CardContent className="flex items-center gap-3 py-1">
          <Route className="h-5 w-5 text-[#FC5200]" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Route overlay</p>
            <p className="text-xs text-neutral-400">Every run of the month drawn on top of each other</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
