"use client";

import { ResultsTable, ResultCandidate } from "./ResultsTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import type { CollaborationState } from "@/lib/collaboration";
import type { JobSummary, WatchlistSummary } from "@/lib/collaborationApi";

/**
 * The results area that fills the rest of the screen next to the filter
 * rail. Shows how many of the total the facet narrowing left on screen, and
 * a one-click way to clear it — kept visually separate from the search
 * controls so narrowing (instant, client-side) never reads like it
 * triggered a new paid search.
 */
export function ResultsArea({
  totalCount,
  visibleCandidates,
  filters,
  currentRunId,
  activeFacetCount,
  onClearNarrowing,
  hasSearchedOnce,
  isGithubSource,
  currentUserId,
  collabByPersonId,
  jobs,
  watchlists,
  onCollabChange,
  onJobCreated,
  onWatchlistCreated,
  onError,
}: {
  totalCount: number;
  visibleCandidates: ResultCandidate[];
  filters: Partial<SearchFilters>;
  currentRunId: string;
  activeFacetCount: number;
  onClearNarrowing: () => void;
  hasSearchedOnce: boolean;
  isGithubSource: boolean;
  currentUserId: string;
  collabByPersonId: Record<string, CollaborationState>;
  jobs: JobSummary[];
  watchlists: WatchlistSummary[];
  onCollabChange: (personId: string, updater: (prev: CollaborationState) => CollaborationState) => void;
  onJobCreated: (job: JobSummary) => void;
  onWatchlistCreated: (watchlist: WatchlistSummary) => void;
  onError: (message: string) => void;
}) {
  if (totalCount === 0) {
    if (!hasSearchedOnce) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div className="max-w-sm">
            <h2 className="text-lg font-semibold mb-1">No search yet</h2>
            <p className="text-sm text-muted-foreground">
              Add a job title, pick a source, and search — results and filter counts will appear here.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <div className="max-w-md">
          <h2 className="text-lg font-semibold mb-1">No candidates matched this search</h2>
          <p className="text-sm text-muted-foreground">
            {isGithubSource
              ? "GitHub ANDs every must-have term together, so it's easy to over-narrow. Try removing a must-have skill or two — fewer must-haves usually surfaces more candidates."
              : "Try widening your filters — fewer must-have requirements usually surfaces more candidates."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto pl-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold">
            {activeFacetCount > 0 ? `${visibleCandidates.length} of ${totalCount}` : totalCount} candidate
            {totalCount === 1 ? "" : "s"}
          </h2>
          {activeFacetCount > 0 && (
            <>
              <Badge variant="secondary">narrowed by {activeFacetCount} filter{activeFacetCount === 1 ? "" : "s"}</Badge>
              <Button variant="ghost" size="sm" onClick={onClearNarrowing}>
                Clear narrowing
              </Button>
            </>
          )}
        </div>
        <a
          href={`/api/export?searchRunId=${currentRunId}`}
          download
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium transition-all hover:bg-muted focus-visible:border-ring"
        >
          Export CSV
        </a>
      </div>
      {visibleCandidates.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-base font-semibold mb-1">No candidates match this narrowing</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {totalCount} candidate{totalCount === 1 ? "" : "s"} are in this search, but none match every selected filter.
          </p>
          <Button variant="outline" size="sm" onClick={onClearNarrowing}>
            Clear narrowing
          </Button>
        </div>
      ) : (
        <ResultsTable
          candidates={visibleCandidates}
          filters={filters}
          currentUserId={currentUserId}
          collabByPersonId={collabByPersonId}
          jobs={jobs}
          watchlists={watchlists}
          onCollabChange={onCollabChange}
          onJobCreated={onJobCreated}
          onWatchlistCreated={onWatchlistCreated}
          onError={onError}
        />
      )}
    </div>
  );
}
