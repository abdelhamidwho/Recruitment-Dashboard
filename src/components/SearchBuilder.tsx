"use client";

import * as React from "react";
import { Option } from "./MultiSelectChips";
import { buildBooleanQuery, SearchFilters } from "@/lib/buildBooleanQuery";
import { buildGithubUserQuery } from "@/lib/sources/github";
import { ResultCandidate } from "./ResultsTable";
import { listSources, APIFY_SOURCE_DESCRIPTION, UNAVAILABLE_SOURCES } from "@/lib/sources";
import { SourceDescription } from "@/lib/sources/types";
import { FilterRail } from "./FilterRail";
import { SearchControls } from "./SearchControls";
import { ResultsArea } from "./ResultsArea";
import {
  applyFacetSelection,
  computeFacetsForDisplay,
  FacetDimension,
  FacetGroupResult,
  FacetSelection,
} from "@/lib/facets";
import type { CollaborationState } from "@/lib/collaboration";
import {
  fetchCollaborationState,
  fetchJobs,
  fetchWatchlists,
  type JobSummary,
  type WatchlistSummary,
} from "@/lib/collaborationApi";

/**
 * Computes what the "query preview" panel should show for the given source.
 * GitHub's actual retrieval query is fully and deterministically derived
 * from `filters` (see buildGithubUserQuery's doc comment) and is rebuilt
 * from scratch server-side on every search — there is no mechanism for a
 * hand-edited string to reach it — so showing GitHub's real `q=` query here
 * is both accurate and (unlike the LinkedIn boolean string) not something
 * hand-editing could ever actually influence. Every other source keeps
 * today's boolean-string preview.
 */
export function buildQueryPreview(sourceId: string, filters: Partial<SearchFilters>): string {
  if (sourceId === "github") return buildGithubUserQuery(filters);
  return buildBooleanQuery(filters);
}

/**
 * Whether the one field the user must always fill in themselves — job
 * title(s) — has been filled in. The owner explicitly rejected the app
 * picking titles for them (role presets), so this is the sole required
 * field and gates the search button. Pure so the disabled-state logic is
 * unit-testable without rendering the component.
 */
export function hasRequiredTitle(filters: Partial<SearchFilters>): boolean {
  return (filters.titles || []).some((t) => typeof t === "string" && t.trim().length > 0);
}

/**
 * Composes the short, plain-language note telling the user that some
 * filters aren't used to find candidates for this source, but are still
 * used to rank them (see CandidateSource.describeRankOnlyFilters). Returns
 * "" when there is nothing to say (no rank-only fragments, e.g. an
 * unimplemented method or one returning []).
 */
export function buildRankOnlyNote(sourceLabel: string, rankOnlyFragments: string[]): string {
  if (rankOnlyFragments.length === 0) return "";
  return `${sourceLabel} won't use ${rankOnlyFragments.join(
    ", ",
  )} to find people, but still uses them to rank results.`;
}

/**
 * Source picker options. Combines the registered synchronous sources
 * (currently just GitHub) with the Apify/LinkedIn source, which is
 * deliberately not in the registry (see src/lib/sources/index.ts) since it
 * owns its own async run/poll lifecycle predating this adapter contract.
 * Kept here rather than fetched from an API since it's static, small, and
 * this is the only place in the UI that needs it.
 */
const SOURCE_OPTIONS: {
  id: string;
  label: string;
  unsupportedFilterFields?: (keyof SearchFilters)[];
  describeRankOnlyFilters?: (filters: Partial<SearchFilters>) => string[];
  description: SourceDescription;
}[] = [
  ...listSources().map((s) => ({
    id: s.id,
    label: s.label,
    unsupportedFilterFields: s.unsupportedFilterFields,
    describeRankOnlyFilters: s.describeRankOnlyFilters,
    description: s.description,
  })),
  { id: "apify", label: "LinkedIn (Apify)", description: APIFY_SOURCE_DESCRIPTION },
];

/** Human-readable labels for the filter keys named in unsupportedFilterFields. */
const FILTER_LABELS: Record<string, string> = {
  yearsMin: "years of experience",
  yearsMax: "years of experience",
  workMode: "work mode",
  companySize: "company size",
  industry: "industry",
  education: "education",
  languages: "spoken languages",
  certifications: "certifications",
  targetCompanies: "target companies",
  excludedCompanies: "excluded companies",
};

interface SkillCategory {
  category: string;
  skills: string[];
}

export function SearchBuilder({
  skillsTaxonomy,
  currentUserId,
  apifyAvailable = false,
}: {
  skillsTaxonomy: SkillCategory[];
  currentUserId: string;
  apifyAvailable?: boolean;
}) {
  const [filters, setFilters] = React.useState<Partial<SearchFilters>>({
    titles: [],
    mustHave: [],
    niceToHave: [],
    exclude: [],
    seniority: [],
    location: [],
    workMode: [],
    targetCompanies: [],
    excludedCompanies: [],
    industry: [],
    companySize: [],
    languages: [],
    certifications: [],
    yearsMin: 0,
    yearsMax: 20,
    limit: 50,
  });

  const [customQuery, setCustomQuery] = React.useState<string>("");
  const [isCustom, setIsCustom] = React.useState(false);
  // Defaults to GitHub: it works with no setup (just a lower rate limit
  // without a token), whereas Apify/LinkedIn is blocked until a real actor
  // is chosen and verified.
  const [source, setSource] = React.useState<string>("github");

  // Facet narrowing state: which values are selected per dimension. This is
  // entirely client-side and filters candidates already on screen — it
  // never triggers a new search against the source (see SearchControls vs
  // FilterRail/ResultsArea).
  const [facetSelection, setFacetSelection] = React.useState<FacetSelection>({});

  const sourceOptions = apifyAvailable ? SOURCE_OPTIONS : SOURCE_OPTIONS.filter((s) => s.id !== "apify");
  const selectedSource = sourceOptions.find((s) => s.id === source);
  // Filters the user has actually set that the chosen source cannot act on
  // at all — surfaced near the search button so a filter isn't silently
  // dropped without the user knowing.
  const unsupportedFilterNote = React.useMemo(() => {
    const unsupported = selectedSource?.unsupportedFilterFields || [];
    const activeUnsupported = unsupported.filter((key) => {
      const value = (filters as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value.length > 0;
      if (key === "yearsMin") return (value as number) > 0;
      if (key === "yearsMax") return (value as number) < 20;
      return Boolean(value);
    });
    if (activeUnsupported.length === 0) return "";
    const labels = Array.from(new Set(activeUnsupported.map((k) => FILTER_LABELS[k] || k)));
    return `${selectedSource?.label} can't filter on ${labels.join(", ")} — ${
      labels.length > 1 ? "these will" : "this will"
    } be ignored for this search.`;
  }, [selectedSource, filters]);

  // Sub-filters this source deliberately excludes from retrieval but still
  // uses (via scoring, downstream of search()) to rank results — distinct
  // from unsupportedFilterNote above, which is filters the source has no
  // way to act on at all. A source without describeRankOnlyFilters (not
  // implemented, or implemented and returning []) is treated the same:
  // no note.
  const rankOnlyNote = React.useMemo(() => {
    const fragments = selectedSource?.describeRankOnlyFilters?.(filters) || [];
    return buildRankOnlyNote(selectedSource?.label || source, fragments);
  }, [selectedSource, filters, source]);

  const seniorityOptions: Option[] = ["Intern", "Junior", "Mid", "Senior", "Staff", "Lead", "Principal", "Manager", "Head", "Director"].map(s => ({ value: s, label: s }));
  const workModeOptions: Option[] = ["Remote", "Hybrid", "Onsite"].map(s => ({ value: s, label: s }));

  // GitHub's query preview is always derived fresh from filters — see
  // buildQueryPreview's doc comment for why hand-editing doesn't make sense
  // for that source. Every other source keeps the existing hand-editable
  // boolean-string preview.
  const isGithubSource = source === "github";

  // Auto-update the boolean-string preview when filters change (if not
  // overridden by the user). Doesn't apply to GitHub, whose preview is
  // computed directly from `filters` on every render instead (see below).
  React.useEffect(() => {
    if (!isCustom && !isGithubSource) {
      setCustomQuery(buildBooleanQuery(filters));
    }
  }, [filters, isCustom, isGithubSource]);

  const previewQuery = isGithubSource ? buildQueryPreview(source, filters) : customQuery;
  const previewLabel = isGithubSource ? "GitHub Query Preview" : "Boolean Preview";

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'portals') return false; // a source setting, not a candidate filter
    if (Array.isArray(v)) return v.length > 0;
    if (k === 'yearsMin' || k === 'yearsMax') return false; // Don't count default ranges
    if (k === 'limit') return false;
    return Boolean(v);
  }).length;

  // The user must always type the job title(s) themselves — see AGENTS.md /
  // the owner's request: role presets are gone, so the title is now the one
  // required field and the search button stays disabled without it.
  const hasTitle = hasRequiredTitle(filters);

  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<ResultCandidate[]>([]);
  const [searchStatus, setSearchStatus] = React.useState<string>("");
  const [currentRunId, setCurrentRunId] = React.useState<string>("");
  // Tracks whether a search has completed (successfully) at least once
  // since the last "Clear all"/new search kicked off, independent of how
  // many results it returned — lets the UI tell "haven't searched yet"
  // apart from "searched and found nothing", which searchResults.length
  // alone can't distinguish.
  const [hasSearchedOnce, setHasSearchedOnce] = React.useState(false);
  const cancelledRef = React.useRef(false);

  // Collaboration state (favourited-by-me, viewers, pipeline stage) for the
  // whole result list, fetched in one batch call — never one request per
  // candidate (see fetchCollaborationState / getCollaborationState). Jobs
  // and watchlists are the shared reference lists the row actions and
  // detail dialog need (which jobs exist to add to, which watchlists are
  // visible to add to).
  const [collabByPersonId, setCollabByPersonId] = React.useState<Record<string, CollaborationState>>({});
  const [jobs, setJobs] = React.useState<JobSummary[]>([]);
  const [watchlists, setWatchlists] = React.useState<WatchlistSummary[]>([]);
  const [collabError, setCollabError] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      const [jobsResult, watchlistsResult] = await Promise.all([fetchJobs(), fetchWatchlists()]);
      if (jobsResult.ok) setJobs(jobsResult.data!.jobs);
      if (watchlistsResult.ok) setWatchlists(watchlistsResult.data!.watchlists);
    })();
  }, []);

  React.useEffect(() => {
    // Nothing to reset synchronously to "{}" when the result list empties —
    // an empty candidates array already renders no rows, so a stale
    // collab-state cache is simply unused, and skipping the reset avoids a
    // synchronous setState at the top of this effect.
    if (searchResults.length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await fetchCollaborationState(searchResults.map((c) => c.id));
      if (cancelled) return;
      if (result.ok) {
        setCollabByPersonId(result.data!.state);
      } else {
        setCollabError(`Couldn't load who's viewed/favourited these candidates: ${result.error}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchResults]);

  /** Applies an optimistic/confirmed update to one candidate's collaboration state, used by row actions and the detail dialog so the table reflects an action without a full batch refetch. */
  const updateCollab = React.useCallback(
    (personId: string, updater: (prev: CollaborationState) => CollaborationState) => {
      setCollabByPersonId((prev) => ({
        ...prev,
        [personId]: updater(prev[personId] ?? { favorited: false, watchlists: [], viewedBy: [], jobs: [] }),
      }));
    },
    [],
  );

  // How long the browser is willing to keep polling before giving up on its
  // own, independent of the server-side SearchRun timeout in
  // src/lib/searchRunTimeout.ts. Matches that 15-minute threshold so the UI
  // gives up at roughly the same point the server marks the run TIMED-OUT.
  const CLIENT_POLL_TIMEOUT_MS = 15 * 60 * 1000;
  // Poll interval backs off from 2s up to 10s so a long-running real scrape
  // doesn't hammer the server for minutes on end.
  const nextPollDelayMs = (elapsedMs: number) => Math.min(2000 + Math.floor(elapsedMs / 15000) * 1000, 10000);

  const handleCancelSearch = () => {
    cancelledRef.current = true;
    setSearchStatus("Cancelled.");
    setIsSearching(false);
  };

  // Opens an existing run read-only, e.g. /?run=<id> after a LinkedIn import.
  React.useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("run");
    if (!runId) return;
    fetch(`/api/search/${runId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status !== "SUCCEEDED") return;
        setCurrentRunId(runId);
        setSearchResults(d.candidates || []);
        setSearchStatus("Loaded imported run.");
        setHasSearchedOnce(true);
      })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!hasTitle) return;
    cancelledRef.current = false;
    setIsSearching(true);
    setSearchStatus(`Searching ${selectedSource?.label || source}...`);
    setCurrentRunId("");
    setHasSearchedOnce(false);
    setFacetSelection({});
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, source }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.failureReason || data.error);

      // Poll, with a bounded total wait and a backing-off interval so a
      // hung Apify run can't poll forever or hammer the server.
      const searchRunId = data.searchRunId;
      setCurrentRunId(searchRunId);
      let status = "RUNNING";
      const startedAt = Date.now();

      while (status === "RUNNING" || status === "READY") {
        if (cancelledRef.current) return;

        const elapsed = Date.now() - startedAt;
        if (elapsed > CLIENT_POLL_TIMEOUT_MS) {
          setSearchStatus(
            `Timed out after ${Math.round(elapsed / 60000)} minutes waiting on the Apify run. It may still be ` +
              `running — check back later, or start a new search.`,
          );
          setIsSearching(false);
          return;
        }

        await new Promise((r) => setTimeout(r, nextPollDelayMs(elapsed)));
        if (cancelledRef.current) return;

        const pollRes = await fetch(`/api/search/${searchRunId}`);
        const pollData = await pollRes.json();
        if (pollData.error) throw new Error(pollData.failureReason || pollData.error);
        status = pollData.status;
        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
        setSearchStatus(`Status: ${status}... (${elapsedSeconds}s elapsed)`);

        if (status === "SUCCEEDED") {
          setSearchResults(pollData.candidates || []);
          const hidden: number = pollData.excludedCount || 0;
          const why: string[] = [...new Set<string>((pollData.excludedSample || []).flatMap((e: { reasons: string[] }) => e.reasons))];
          setSearchStatus(
            hidden > 0
              ? `Done! ${hidden} candidate${hidden === 1 ? "" : "s"} hidden because they failed a requirement` +
                  (why.length ? ` (e.g. ${why.slice(0, 3).join("; ")})` : "") +
                  ". Remove or fix those requirements to see them."
              : "Done!",
          );
          setIsSearching(false);
          setHasSearchedOnce(true);
          return;
        }

        if (status === "TIMED-OUT" || status === "FAILED" || status === "ABORTED") {
          setSearchStatus(
            pollData.failureReason
              ? `Run ${status}: ${pollData.failureReason}`
              : `Run finished with status: ${status}`,
          );
          setIsSearching(false);
          return;
        }
      }
      setSearchStatus(`Run finished with status: ${status}`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setSearchStatus(`Error: ${message}`);
    }
    setIsSearching(false);
  };

  // Deep scan: sends the best LinkedIn candidates of this run to Apify for full
  // details (work history, skills, education), then reloads the run's results.
  const [isDeepScanning, setIsDeepScanning] = React.useState(false);
  const handleDeepScan = async () => {
    if (!currentRunId || isDeepScanning) return;
    setIsDeepScanning(true);
    try {
      setSearchStatus("Deep scan: starting…");
      const startRes = await fetch("/api/deep-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchRunId: currentRunId, count: 10 }),
      });
      const start = await startRes.json();
      if (start.error) throw new Error(start.error);

      const query = new URLSearchParams({
        searchRunId: currentRunId,
        datasetId: start.datasetId,
        urls: start.urls.join(","),
      });
      const startedAt = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 4000));
        const res = await fetch(`/api/deep-scan/${start.runId}?${query}`);
        const poll = await res.json();
        if (poll.status === "SUCCEEDED") break;
        if (poll.failureReason || poll.error) throw new Error(poll.failureReason || poll.error);
        if (Date.now() - startedAt > 5 * 60 * 1000) throw new Error("Deep scan took too long; try again later.");
        setSearchStatus(`Deep scan: reading ${start.count} profiles… (${Math.round((Date.now() - startedAt) / 1000)}s)`);
      }

      const refreshed = await (await fetch(`/api/search/${currentRunId}`)).json();
      setSearchResults(refreshed.candidates || []);
      setSearchStatus(`Deep scan done: ${start.count} profile${start.count === 1 ? "" : "s"} now have full details.`);
    } catch (err) {
      setSearchStatus(`Deep scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeepScanning(false);
    }
  };

  const handleClearAll = () => {
    setFilters({ yearsMin: 0, yearsMax: 20, limit: 50 });
    setIsCustom(false);
    setSearchResults([]);
    setCurrentRunId("");
    setHasSearchedOnce(false);
    setSearchStatus("");
    setFacetSelection({});
  };

  // Facet narrowing: computed purely from the current result set (see
  // src/lib/facets.ts) — never from the whole database — and recomputed
  // whenever results or the selection change.
  const facetGroups = React.useMemo(
    () => computeFacetsForDisplay(searchResults, facetSelection),
    [searchResults, facetSelection],
  );
  const facetsByKey = React.useMemo(
    () => Object.fromEntries(facetGroups.map((g) => [g.key, g])) as Record<FacetDimension, FacetGroupResult>,
    [facetGroups],
  );
  const visibleCandidates = React.useMemo(
    () => applyFacetSelection(searchResults, facetSelection),
    [searchResults, facetSelection],
  );
  const activeFacetCount = Object.values(facetSelection).filter((v) => (v?.length ?? 0) > 0).length;

  const toggleFacet = (dimension: FacetDimension, value: string) => {
    setFacetSelection((prev) => {
      const current = prev[dimension] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [dimension]: next };
    });
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-[96rem] w-full mx-auto">
      <SearchControls
        filters={filters}
        updateFilter={updateFilter}
        previewQuery={previewQuery}
        previewLabel={previewLabel}
        isGithubSource={isGithubSource}
        onPreviewChange={(value) => {
          if (isGithubSource) return;
          setCustomQuery(value);
          setIsCustom(true);
        }}
        isCustom={isCustom}
        sourceOptions={sourceOptions}
        source={source}
        setSource={setSource}
        selectedSource={selectedSource}
        unavailableSources={UNAVAILABLE_SOURCES}
        unsupportedFilterNote={unsupportedFilterNote}
        rankOnlyNote={rankOnlyNote}
        activeFiltersCount={activeFiltersCount}
        isSearching={isSearching}
        hasTitle={hasTitle}
        onSearch={handleSearch}
        onCancel={handleCancelSearch}
        onClear={handleClearAll}
        searchStatus={searchStatus}
      />

      <div className="flex flex-1 min-h-0 gap-6 flex-col md:flex-row">
        <FilterRail
          filters={filters}
          updateFilter={updateFilter}
          skillsTaxonomy={skillsTaxonomy}
          seniorityOptions={seniorityOptions}
          workModeOptions={workModeOptions}
          facetsByKey={facetsByKey}
          selection={facetSelection}
          onToggleFacet={toggleFacet}
          activeFacetCount={activeFacetCount}
        />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {collabError && (
            <div role="alert" className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {collabError}{" "}
              <button type="button" className="underline" onClick={() => setCollabError("")}>Dismiss</button>
            </div>
          )}
          <ResultsArea
            totalCount={searchResults.length}
            visibleCandidates={visibleCandidates}
            filters={filters}
            currentRunId={currentRunId}
            activeFacetCount={activeFacetCount}
            onClearNarrowing={() => setFacetSelection({})}
            hasSearchedOnce={hasSearchedOnce}
            isGithubSource={isGithubSource}
            currentUserId={currentUserId}
            collabByPersonId={collabByPersonId}
            jobs={jobs}
            watchlists={watchlists}
            onCollabChange={updateCollab}
            onJobCreated={(job) => setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)])}
            onWatchlistCreated={(wl) => setWatchlists((prev) => [wl, ...prev.filter((w) => w.id !== wl.id)])}
            onError={setCollabError}
            canDeepScan={
              apifyAvailable &&
              !isSearching &&
              searchResults.some((c) => /linkedin\.com\/in\//i.test(c.profileUrl))
            }
            isDeepScanning={isDeepScanning}
            onDeepScan={handleDeepScan}
          />
        </div>
      </div>
    </div>
  );
}
