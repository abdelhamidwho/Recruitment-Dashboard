"use client";

import { FacetValue, NOT_SPECIFIED } from "@/lib/facets";
import { cn } from "@/lib/utils";

/**
 * One facet dimension's clickable value list — "Egypt 24, UAE 9, Saudi 6" —
 * computed from the current result set (see src/lib/facets.ts). Clicking a
 * value narrows the on-screen candidate list; clicking it again clears it.
 * This is facet narrowing, not a search filter: it never triggers a new
 * search against the source (see FilterRail/SearchBuilder for that
 * distinction).
 */
export function FacetList({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: FacetValue[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="text-base font-medium mb-1.5">{label}</p>
      <ul className="space-y-0.5">
        {values.map((v) => {
          const isSelected = selected.includes(v.value);
          const isNotSpecified = v.value === NOT_SPECIFIED;
          return (
            <li key={v.value}>
              <button
                type="button"
                onClick={() => onToggle(v.value)}
                aria-pressed={isSelected}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-base transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  isNotSpecified && !isSelected && "text-muted-foreground italic",
                )}
                title={isNotSpecified ? "Filtering on missing data" : undefined}
              >
                <span className="truncate text-left">{v.label}</span>
                <span className={cn("tabular-nums", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                  {v.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
