/**
 * The coach passcode, shared by every screen that spends API credit, so
 * unlocking the Coach tab also unlocks the Splits tab.
 *
 * Exposed as a subscribable store rather than per-page state: localStorage
 * can't be read while rendering on the server, and a store lets both tabs
 * (and a second browser tab) see an unlock the moment it happens.
 */
const PASSCODE_KEY = "coach_passcode";

const listeners = new Set<() => void>();

/** Private browsing rejects localStorage writes; hold the passcode for the visit. */
let memoryPasscode: string | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePasscode(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab unlocking counts too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The stored passcode, or null. Safe to call as a `useSyncExternalStore` snapshot. */
export function loadPasscode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? memoryPasscode;
  } catch {
    return memoryPasscode;
  }
}

/** Nothing is unlocked during server rendering. */
export function noPasscode(): null {
  return null;
}

export function savePasscode(passcode: string) {
  memoryPasscode = passcode;
  try {
    localStorage.setItem(PASSCODE_KEY, passcode);
  } catch {
    // Private mode — the in-memory copy carries this visit.
  }
  emit();
}

export function clearPasscode() {
  memoryPasscode = null;
  try {
    localStorage.removeItem(PASSCODE_KEY);
  } catch {}
  emit();
}

/**
 * Convex wraps action errors with a stack trace and framework noise. Pull out
 * the first meaningful line so the UI shows the real cause (bad key, no
 * credits, rate limit) instead of a generic guess.
 */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cleaned = e.message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("at ") && !l.startsWith("Called by"))
    .join(" ");
  return cleaned || e.message;
}

export function isWrongPasscode(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Wrong passcode");
}
