/**
 * A real Apify run can take minutes; a hung one must not leave a SearchRun
 * stuck at RUNNING/READY forever (the GET route would otherwise poll it
 * indefinitely and the UI would spin forever alongside it). This threshold
 * is how long a run is allowed to sit unresolved before the GET route
 * marks it TIMED-OUT (see SearchRun.status in prisma/schema.prisma, which
 * already documents TIMED-OUT as a valid value).
 */
export const SEARCH_RUN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const UNRESOLVED_STATUSES = new Set(["RUNNING", "READY"]);

/**
 * Pure decision function: given the run's current status and when it
 * started, should it be recorded as timed out? Kept separate from the
 * route handler so it is testable without a database or clock mocking
 * beyond passing an explicit `now`.
 */
export function isSearchRunTimedOut(status: string, startedAt: Date, now: Date = new Date()): boolean {
  if (!UNRESOLVED_STATUSES.has(status)) return false;
  return now.getTime() - startedAt.getTime() > SEARCH_RUN_TIMEOUT_MS;
}

export function searchRunTimeoutReason(startedAt: Date, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);
  return (
    `Apify run did not finish within ${SEARCH_RUN_TIMEOUT_MS / 60000} minutes (been running ${minutes} ` +
    `minute${minutes === 1 ? "" : "s"}). Marked TIMED-OUT so it stops being polled; the underlying Apify ` +
    `run may still be active — check the Apify console if you need to confirm or abort it.`
  );
}
