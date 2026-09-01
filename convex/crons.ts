import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 10:00 UTC = 6:00 AM Toronto (EDT). Race is Oct 4, so the whole plan runs on EDT.
crons.cron("morning coach briefing", "0 10 * * *", internal.coachActions.generateBriefing, {});

// Monday 5:30 AM Toronto (09:30 UTC during EDT) — reviews the week that just
// ended (Mon-Sun) after Sunday's uploads have landed, and before the morning
// briefing so the briefing can build on it.
crons.cron("weekly coach review", "30 9 * * 1", internal.coachActions.generateWeeklyReview, {});

export default crons;
