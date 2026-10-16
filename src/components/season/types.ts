import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type ActiveSeason = NonNullable<FunctionReturnType<typeof api.seasons.getActiveSeason>>;
export type SeasonWeek = FunctionReturnType<typeof api.seasons.getSeasonWeek>;
export type WeekRun = NonNullable<SeasonWeek["fills"][string]>;
