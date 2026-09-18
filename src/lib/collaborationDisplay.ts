/**
 * Pure display logic for collaboration state, shared between the compact
 * row indicators (ResultsTable) and the candidate detail view. Kept out of
 * components so the "what does this say" question is unit-testable without
 * rendering anything.
 */

export interface ViewerLike {
  userId: string;
  name: string;
}

/**
 * Turns a list of viewers into the short "who's seen this person" label the
 * row/detail view show. Answers the owner's core question — "has anyone
 * looked at this person already?" — at a glance:
 *   []                                -> "Not viewed yet"
 *   [you]                             -> "Viewed by you"
 *   [Sara]                            -> "Viewed by Sara"
 *   [Sara, you]                       -> "Viewed by Sara and you"
 *   [Sara, Ken]                       -> "Viewed by Sara and Ken"
 *   [Sara, Ken, Lee]                  -> "Viewed by Sara +2 more"
 *   [Sara, Ken, Lee, you]             -> "Viewed by Sara +2 more and you"
 */
export function summarizeViewers(viewedBy: ViewerLike[], currentUserId: string): string {
  if (viewedBy.length === 0) return "Not viewed yet";

  const byMe = viewedBy.some((v) => v.userId === currentUserId);
  const others = viewedBy.filter((v) => v.userId !== currentUserId);
  const suffix = byMe ? " and you" : "";

  if (others.length === 0) return "Viewed by you";
  if (others.length === 1) return `Viewed by ${others[0].name}${suffix}`;
  if (others.length === 2 && !byMe) return `Viewed by ${others[0].name} and ${others[1].name}`;

  return `Viewed by ${others[0].name} +${others.length - 1} more${suffix}`;
}

export interface PipelineEntryLike {
  jobId: string;
  jobTitle: string;
  stage: string;
}

/**
 * What the row's compact pipeline badge should show: nothing for a
 * candidate in no job, the single stage for one job, or a "N pipelines"
 * summary once a candidate is in more than one — full detail lives in the
 * detail view, not the row.
 */
export function summarizePipeline(jobs: PipelineEntryLike[]): string | null {
  if (jobs.length === 0) return null;
  if (jobs.length === 1) return jobs[0].stage;
  return `${jobs.length} pipelines`;
}
