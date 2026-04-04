/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as backfill from "../backfill.js";
import type * as journal from "../journal.js";
import type * as lib_stravaMapping from "../lib/stravaMapping.js";
import type * as lib_weatherOptimizer from "../lib/weatherOptimizer.js";
import type * as seed from "../seed.js";
import type * as strava from "../strava.js";
import type * as weather from "../weather.js";
import type * as weatherOptimize from "../weatherOptimize.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  backfill: typeof backfill;
  journal: typeof journal;
  "lib/stravaMapping": typeof lib_stravaMapping;
  "lib/weatherOptimizer": typeof lib_weatherOptimizer;
  seed: typeof seed;
  strava: typeof strava;
  weather: typeof weather;
  weatherOptimize: typeof weatherOptimize;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
