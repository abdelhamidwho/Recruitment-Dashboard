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
  return (
    <div className="border-b pb-4 mb-4 space-y-3">
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium">
            Job Title <span className="text-red-600">*</span>
          </label>
          <MultiSelectChips
            options={[]}
            value={filters.titles || []}
            onChange={(val) => updateFilter("titles", val)}
            placeholder='Type a title and press Enter, e.g. "Backend Engineer"'
          />
          {!hasTitle && !isSearching && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Required — add a job title to search. It&apos;s the one thing you always have to enter yourself.
            </p>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col gap-1.5">
          <label className="text-sm font-medium">Source</label>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map((opt) => (
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

        <div className="w-full md:w-48 flex flex-col gap-1.5 md:pt-6">
          <Button size="lg" onClick={onSearch} disabled={isSearching || !hasTitle}>
            {isSearching ? "Searching..." : `Search ${selectedSource?.label || ""}`}
          </Button>
          {isSearching && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="ghost" onClick={onClear} disabled={isSearching}>
            Clear all
          </Button>
        </div>
      </div>

      {searchStatus && <p className="text-xs text-muted-foreground">{searchStatus}</p>}

      {selectedSource && (
        <SourceDescriptionPanel sourceLabel={selectedSource.label} description={selectedSource.description} />
      )}
      <UnavailableSourcesNote sources={unavailableSources} />
      {unsupportedFilterNote && <p className="text-xs text-amber-600 dark:text-amber-500">{unsupportedFilterNote}</p>}
      {rankOnlyNote && <p className="text-xs text-muted-foreground">{rankOnlyNote}</p>}

      <CollapsibleSection
        title="Search details"
        badge={<Badge variant="secondary">{activeFiltersCount} filters</Badge>}
      >
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-muted-foreground">{previewLabel}</span>
          </div>
          <Textarea
            value={previewQuery}
            onChange={(e) => onPreviewChange(e.target.value)}
            readOnly={isGithubSource}
            className="h-28 font-mono text-xs"
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
