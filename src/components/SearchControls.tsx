"use client";

import * as React from "react";
import { MultiSelectChips } from "./MultiSelectChips";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SourceDescriptionPanel, UnavailableSourcesNote } from "./SourceDescriptionPanel";
import { UnavailableSource } from "@/lib/sources/staticSourceInfo";
import { SourceDescription } from "@/lib/sources/types";
import { CollapsibleSection } from "./CollapsibleSection";
import { Search as SearchIcon, X, Eraser, Code2, Users, UserSearch, Globe, CheckCircle2 } from "lucide-react";
import { XRAY_PORTALS, UNAVAILABLE_PORTALS, selectedPortals } from "@/lib/sources/linkedinXray";

interface SourceOption {
  id: string;
  label: string;
  description: SourceDescription;
}

/**
 * The search-setup strip: job title (the one required field), source
 * picker, and the search/cancel/clear actions, kept compact across the top
 * so it stays reachable without dominating the screen the way the old
 * one-long-column layout did. All the Phase 1 honesty elements — source
 * description, unavailable-sources note, unsupported-filter note,
 * rank-only note, and the source-aware query preview — live here, folded
 * into a "Search details" section so they don't compete with the filter
 * rail and results for space, but are one click away.
 *
 * Everything here is about what gets SENT TO THE SOURCE on the next
 * search — distinct from the filter rail's facet narrowing, which only
 * re-filters candidates already on screen.
 */
export function SearchControls({
  filters,
  updateFilter,
  previewQuery,
  previewLabel,
  isGithubSource,
  onPreviewChange,
  isCustom,
  sourceOptions,
  source,
  setSource,
  selectedSource,
  unavailableSources,
  unsupportedFilterNote,
  rankOnlyNote,
  activeFiltersCount,
  isSearching,
  hasTitle,
  onSearch,
  onCancel,
  onClear,
  searchStatus,
}: {
  filters: Partial<SearchFilters>;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  previewQuery: string;
  previewLabel: string;
  isGithubSource: boolean;
  onPreviewChange: (value: string) => void;
  isCustom: boolean;
  sourceOptions: SourceOption[];
  source: string;
  setSource: (id: string) => void;
  selectedSource: SourceOption | undefined;
  unavailableSources: UnavailableSource[];
  unsupportedFilterNote: string;
  rankOnlyNote: string;
  activeFiltersCount: number;
  isSearching: boolean;
  hasTitle: boolean;
  onSearch: () => void;
  onCancel: () => void;
  onClear: () => void;
  searchStatus: string;
}) {
  const SOURCE_ICON: Record<string, React.ElementType> = {
    github: Code2,
    "linkedin-xray": Users,
    apify: UserSearch,
  };
  const SOURCE_HINT: Record<string, string> = {
    github: "Software developers with public code",
    "linkedin-xray": "Public LinkedIn profiles found through Google",
    apify: "Detailed LinkedIn profiles (paid)",
  };
  const stepBadge = (n: number) => (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-deep)] text-lg font-bold text-white">{n}</span>
  );

  return (
    <div className="mb-6 space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
      <section className="space-y-2">
        <div className="flex items-center gap-3">
          {stepBadge(1)}
          <label className="text-xl font-semibold">
            What role are you hiring for? <span className="text-destructive">*</span>
          </label>
        </div>
        <div className="pl-12">
          <MultiSelectChips
            options={[]}
            value={filters.titles || []}
            onChange={(val) => updateFilter("titles", val)}
            placeholder='Type a job title, then press Enter — e.g. "Accountant"'
          />
          {!hasTitle && !isSearching && (
            <p className="text-base text-[var(--brand-deep)] mt-1.5 font-medium">
              Start by typing a job title above. That is the only thing you must fill in.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          {stepBadge(2)}
          <label className="text-xl font-semibold">Where should we look?</label>
        </div>
        <div className="pl-12 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourceOptions.map((opt) => {
              const Icon = SOURCE_ICON[opt.id] ?? Globe;
              const on = source === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSource(opt.id)}
                  disabled={isSearching}
                  aria-pressed={on}
                  className={
                    "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-50 " +
                    (on ? "border-[var(--brand-deep)] bg-[var(--brand-tint)]" : "border-border bg-white hover:border-[var(--brand-soft)]")
                  }
                >
                  <Icon aria-hidden className={"size-9 shrink-0 " + (on ? "text-[var(--brand-deep)]" : "text-[var(--grey)]")} />
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold leading-tight">{opt.label}</span>
                    <span className="block text-sm text-muted-foreground">{SOURCE_HINT[opt.id] ?? "Search this source"}</span>
                  </span>
                  {on && <CheckCircle2 aria-hidden className="ml-auto size-6 shrink-0 text-[var(--brand-deep)]" />}
                </button>
              );
            })}
          </div>
          {source === "linkedin-xray" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-muted-foreground">Job sites to search</span>
              <div className="flex flex-wrap gap-2">
                {XRAY_PORTALS.map((p) => {
                  const picked = selectedPortals(filters.portals);
                  const on = picked.includes(p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      disabled={isSearching}
                      onClick={() => {
                        const next = on ? picked.filter((x) => x !== p.id) : [...picked, p.id];
                        // Never leave zero portals selected.
                        updateFilter("portals", next.length > 0 ? next : picked);
                      }}
                    >
                      {p.label}
                    </Button>
                  );
                })}
                {UNAVAILABLE_PORTALS.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant="outline" disabled title={p.reason}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Indeed and Glassdoor are greyed out because they do not show public candidate profiles.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        {stepBadge(3)}
        <Button size="lg" className="h-14 px-8 text-xl" onClick={onSearch} disabled={isSearching || !hasTitle}>
          <SearchIcon aria-hidden className="size-6" />
          {isSearching ? "Searching…" : "Find candidates"}
        </Button>
        {isSearching && (
          <Button variant="outline" size="lg" onClick={onCancel}>
            <X aria-hidden />
            Stop
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={onClear} disabled={isSearching}>
          <Eraser aria-hidden />
          Start over
        </Button>
      </section>

      {searchStatus && <p className="text-base text-muted-foreground">{searchStatus}</p>}

      {unsupportedFilterNote && <p className="text-base text-[var(--brand-deep)]">{unsupportedFilterNote}</p>}
      {rankOnlyNote && <p className="text-base text-muted-foreground">{rankOnlyNote}</p>}

      <CollapsibleSection title="About this source" badge={selectedSource ? <Badge variant="secondary">{selectedSource.label}</Badge> : undefined}>
        {selectedSource && (
          <SourceDescriptionPanel sourceLabel={selectedSource.label} description={selectedSource.description} />
        )}
        <UnavailableSourcesNote sources={unavailableSources} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Advanced: exact search text (optional)"
        badge={<Badge variant="secondary">{activeFiltersCount} filters</Badge>}
      >
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-muted-foreground">{previewLabel}</span>
          </div>
          <Textarea
            value={previewQuery}
            onChange={(e) => onPreviewChange(e.target.value)}
            readOnly={isGithubSource}
            className="h-28 font-mono text-sm"
            placeholder={isGithubSource ? "GitHub query will appear here..." : "Boolean string will appear here..."}
          />
          {isGithubSource ? (
            <p className="text-xs text-muted-foreground mt-1">
              This is the actual query sent to GitHub, rebuilt from your filters — not hand-editable.
            </p>
          ) : (
            isCustom && <p className="text-xs text-muted-foreground mt-1">Custom query mode active</p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
