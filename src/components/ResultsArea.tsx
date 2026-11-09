"use client";

import * as React from "react";
import { Type, MousePointerClick, Search, Heart, Download } from "lucide-react";
import { ResultsTable, ResultCandidate } from "./ResultsTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import type { CollaborationState } from "@/lib/collaboration";
import type { JobSummary, WatchlistSummary } from "@/lib/collaborationApi";

const STEPS: { Icon: React.ElementType; title: string; text: string }[] = [
  { Icon: Type, title: "Type the job title", text: "For example “Accountant” or “Sales Manager”." },
  { Icon: MousePointerClick, title: "Pick where to look", text: "Choose one of the sources above." },
  { Icon: Search, title: "Press Find candidates", text: "Your results appear here, ranked best first." },
  { Icon: Heart, title: "Save the good ones", text: "Mark favourites or add people to a job or watchlist." },
];

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
  canDeepScan = false,
  isDeepScanning = false,
  onDeepScan,
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
  canDeepScan?: boolean;
  isDeepScanning?: boolean;
  onDeepScan?: () => void;
}) {
  if (totalCount === 0) {
    if (!hasSearchedOnce) {
      return (
        <div className="flex-1 rounded-2xl border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-5">How it works</h2>
          <ol className="space-y-5">
            {STEPS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--brand-tint)]">
                  <Icon aria-hidden className="size-8 text-[var(--brand-deep)]" />
                </span>
                <span>
                  <span className="block text-lg font-semibold">{title}</span>
                  <span className="block text-base text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-2">No candidates matched this search</h2>
          <p className="text-sm text-muted-foreground">
            {isGithubSource
              ? "Nobody matched every skill you required. Try removing one or two “must have” skills — fewer requirements usually finds more people."
              : "Try removing some filters — fewer requirements usually finds more people."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-3xl font-bold">
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
        {canDeepScan && onDeepScan && (
          <Button
            onClick={onDeepScan}
            disabled={isDeepScanning}
            title="Reads the full LinkedIn profile (work history, skills, education) of the 10 best candidates still missing it. Paid Apify: about 4 cents for 10."
          >
            {isDeepScanning ? "Reading profiles…" : "Read full profiles of top 10"}
          </Button>
        )}
        <a
          href={`/api/export?searchRunId=${currentRunId}`}
          download
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-[var(--brand-deep)] bg-white text-[var(--brand-deep)] px-4 h-11 text-base font-semibold transition-all hover:bg-muted focus-visible:border-ring"
        >
          <Download aria-hidden className="size-5" />
          Download as spreadsheet
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
