"use client";

import * as React from "react";
import { MultiSelectChips, Option } from "./MultiSelectChips";
import { buildBooleanQuery, SearchFilters } from "@/lib/buildBooleanQuery";
import { buildGithubUserQuery } from "@/lib/sources/github";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ResultsTable, ResultCandidate } from "./ResultsTable";
import { listSources } from "@/lib/sources";

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
}[] = [
  ...listSources().map((s) => ({
    id: s.id,
    label: s.label,
    unsupportedFilterFields: s.unsupportedFilterFields,
    describeRankOnlyFilters: s.describeRankOnlyFilters,
  })),
  { id: "apify", label: "LinkedIn (Apify)" },
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

interface RolePreset {
  id: string;
  label: string;
  titles?: string[];
  seniority?: string[];
  mustHave?: string[];
  niceToHave?: string[];
  exclude?: string[];
  yearsMin?: number;
  yearsMax?: number;
}

export function SearchBuilder({
  skillsTaxonomy,
  rolePresets,
}: {
  skillsTaxonomy: SkillCategory[];
  rolePresets: RolePreset[];
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

  const selectedSource = SOURCE_OPTIONS.find((s) => s.id === source);
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

  // Generate options for MultiSelect
  const skillOptions: Option[] = skillsTaxonomy.flatMap((cat) =>
    cat.skills.map((skill: string) => ({
      value: skill,
      label: skill,
      category: cat.category,
    }))
  );

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

  const handleApplyPreset = (presetId: string) => {
    const preset = rolePresets.find((p) => p.id === presetId);
    if (!preset) return;
    
    setFilters((prev) => ({
      ...prev,
      rolePreset: preset.id,
      titles: [...new Set([...(prev.titles || []), ...(preset.titles || [])])],
      seniority: [...new Set([...(prev.seniority || []), ...(preset.seniority || [])])],
      mustHave: [...new Set([...(prev.mustHave || []), ...(preset.mustHave || [])])],
      niceToHave: [...new Set([...(prev.niceToHave || []), ...(preset.niceToHave || [])])],
      exclude: [...new Set([...(prev.exclude || []), ...(preset.exclude || [])])],
      yearsMin: preset.yearsMin ?? prev.yearsMin,
      yearsMax: preset.yearsMax ?? prev.yearsMax,
    }));
    setIsCustom(false);
  };

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    if (k === 'yearsMin' || k === 'yearsMax') return false; // Don't count default ranges
    if (k === 'limit') return false;
    return Boolean(v);
  }).length;

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

  const handleSearch = async () => {
    cancelledRef.current = false;
    setIsSearching(true);
    setSearchStatus(`Searching ${selectedSource?.label || source}...`);
    setCurrentRunId("");
    setHasSearchedOnce(false);
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
          setSearchStatus("Done!");
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

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left panel: Filter Builder */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Role Preset</h2>
            <div className="flex flex-wrap gap-2">
              {rolePresets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={filters.rolePreset === preset.id ? "default" : "outline"}
                  onClick={() => handleApplyPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Job Titles</label>
              <MultiSelectChips
                options={[]} // purely custom for now
                value={filters.titles || []}
                onChange={(val) => updateFilter("titles", val)}
                placeholder="e.g. Software Engineer"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <MultiSelectChips
                options={[]}
                value={filters.location || []}
                onChange={(val) => updateFilter("location", val)}
                placeholder="e.g. Cairo, Egypt"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Seniority</label>
              <MultiSelectChips
                options={seniorityOptions}
                value={filters.seniority || []}
                onChange={(val) => updateFilter("seniority", val)}
                placeholder="Select seniority..."
                allowCustom={false}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Must-have Skills</label>
              <MultiSelectChips
                options={skillOptions}
                value={filters.mustHave || []}
                onChange={(val) => updateFilter("mustHave", val)}
                placeholder="Select skills..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nice-to-have Skills</label>
              <MultiSelectChips
                options={skillOptions}
                value={filters.niceToHave || []}
                onChange={(val) => updateFilter("niceToHave", val)}
                placeholder="Select skills..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Excluded Keywords</label>
              <MultiSelectChips
                options={[]}
                value={filters.exclude || []}
                onChange={(val) => updateFilter("exclude", val)}
                placeholder="e.g. Intern, Student"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Work Mode</label>
              <MultiSelectChips
                options={workModeOptions}
                value={filters.workMode || []}
                onChange={(val) => updateFilter("workMode", val)}
                placeholder="Select mode..."
                allowCustom={false}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Years of Experience ({filters.yearsMin} - {filters.yearsMax} yrs)</label>
            <div className="pt-4 px-2">
              <Slider
                defaultValue={[0, 20]}
                value={[filters.yearsMin || 0, filters.yearsMax || 20]}
                max={20}
                step={1}
                onValueChange={(val) => {
                  const [min, max] = val as number[];
                  updateFilter("yearsMin", min);
                  updateFilter("yearsMax", max);
                }}
              />
            </div>
          </div>
        </div>

        {/* Right panel: Live Preview & Actions */}
        <div className="w-full md:w-80 border-l pl-6 space-y-6 sticky top-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">{previewLabel}</h2>
              <Badge variant="secondary">{activeFiltersCount} filters</Badge>
            </div>
            <Textarea
              value={previewQuery}
              onChange={(e) => {
                if (isGithubSource) return;
                setCustomQuery(e.target.value);
                setIsCustom(true);
              }}
              readOnly={isGithubSource}
              className="h-40 font-mono text-sm"
              placeholder={isGithubSource ? "GitHub query will appear here..." : "Boolean string will appear here..."}
            />
            {isGithubSource ? (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                This is the actual query sent to GitHub, rebuilt from your filters — not hand-editable.
              </p>
            ) : (
              isCustom && (
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  Custom query mode active
                </p>
              )
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">Source</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SOURCE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    variant={source === opt.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSource(opt.id)}
                    disabled={isSearching}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {unsupportedFilterNote && (
              <p className="text-xs text-amber-600 dark:text-amber-500">{unsupportedFilterNote}</p>
            )}
            {rankOnlyNote && (
              <p className="text-xs text-muted-foreground">{rankOnlyNote}</p>
            )}
            <Button className="w-full" size="lg" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Searching..." : `Search ${selectedSource?.label || ""}`}
            </Button>
            {isSearching && (
              <Button variant="outline" className="w-full" onClick={handleCancelSearch}>
                Cancel
              </Button>
            )}
            {searchStatus && <p className="text-xs text-center text-muted-foreground">{searchStatus}</p>}
            <Button variant="outline" className="w-full" onClick={() => {
              setFilters({ yearsMin: 0, yearsMax: 20, limit: 50 });
              setIsCustom(false);
              setSearchResults([]);
              setCurrentRunId("");
              setHasSearchedOnce(false);
              setSearchStatus("");
            }} disabled={isSearching}>
              Clear all
            </Button>
            <Button variant="ghost" className="w-full" disabled={isSearching}>
              Save as preset
            </Button>
          </div>
        </div>
      </div>
      
      {searchResults.length > 0 && (
        <div className="mt-8 border-t pt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Results ({searchResults.length})</h2>
            <a href={`/api/export?searchRunId=${currentRunId}`} download className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium transition-all hover:bg-muted focus-visible:border-ring">
              Export CSV
            </a>
          </div>
          <ResultsTable candidates={searchResults} filters={filters} />
        </div>
      )}

      {hasSearchedOnce && searchResults.length === 0 && (
        <div className="mt-8 border-t pt-8 text-center">
          <h2 className="text-lg font-semibold mb-1">No candidates matched this search</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isGithubSource
              ? "GitHub ANDs every must-have term together, so it's easy to over-narrow. Try removing a must-have skill or two — fewer must-haves usually surfaces more candidates."
              : "Try widening your filters — fewer must-have requirements usually surfaces more candidates."}
          </p>
        </div>
      )}
    </div>
  );
}
