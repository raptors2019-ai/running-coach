import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 10:00 UTC = 6:00 AM Toronto (EDT). Race is Oct 4, so the whole plan runs on EDT.
crons.cron("morning coach briefing", "0 10 * * *", internal.coachActions.generateBriefing, {});

// Sunday 8 PM Toronto (Mon 00:00 UTC during EDT) — closes out the training week
crons.cron("weekly coach review", "0 0 * * 1", internal.coachActions.generateWeeklyReview, {});

export default crons;
