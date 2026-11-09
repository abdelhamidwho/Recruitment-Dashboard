"use client";

import * as React from "react";
import { MultiSelectChips, Option } from "./MultiSelectChips";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { Slider } from "@/components/ui/slider";
import { CollapsibleSection } from "./CollapsibleSection";
import { FacetList } from "./FacetList";
import { Badge } from "@/components/ui/badge";
import { FacetDimension, FacetGroupResult, FacetSelection } from "@/lib/facets";

interface SkillCategory {
  category: string;
  skills: string[];
}

/**
 * The folded left rail: collapsed groups of search filters (sent to the
 * source on the next search) plus, within the same clusters, facet
 * narrowing controls (computed from the current results, filter the
 * on-screen list immediately with no new search). Each group makes that
 * split explicit with its own sub-heading rather than mixing the two kinds
 * of control unlabeled.
 */
export function FilterRail({
  filters,
  updateFilter,
  skillsTaxonomy,
  seniorityOptions,
  workModeOptions,
  facetsByKey,
  selection,
  onToggleFacet,
  activeFacetCount,
}: {
  filters: Partial<SearchFilters>;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  skillsTaxonomy: SkillCategory[];
  seniorityOptions: Option[];
  workModeOptions: Option[];
  facetsByKey: Record<FacetDimension, FacetGroupResult>;
  selection: FacetSelection;
  onToggleFacet: (dimension: FacetDimension, value: string) => void;
  activeFacetCount: number;
}) {
  const skillOptions: Option[] = skillsTaxonomy.flatMap((cat) =>
    cat.skills.map((skill: string) => ({ value: skill, label: skill, category: cat.category })),
  );

  const selectedIn = (dim: FacetDimension) => selection[dim] || [];

  return (
    <div className="w-full md:w-80 shrink-0 self-start rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-xl font-bold">Refine (optional)</h2>
        {activeFacetCount > 0 && <Badge variant="secondary">{activeFacetCount} narrowing</Badge>}
      </div>

      <CollapsibleSection title="Skills & seniority" defaultOpen>
        <div>
          <label className="text-base font-medium text-foreground">Must have these skills</label>
          <MultiSelectChips options={skillOptions} value={filters.mustHave || []} onChange={(v) => updateFilter("mustHave", v)} placeholder="Select skills..." />
        </div>
        <div>
          <label className="text-base font-medium text-foreground">Bonus skills</label>
          <MultiSelectChips options={skillOptions} value={filters.niceToHave || []} onChange={(v) => updateFilter("niceToHave", v)} placeholder="Select skills..." />
        </div>
        <div>
          <label className="text-base font-medium text-foreground">Leave out people with</label>
          <MultiSelectChips options={[]} value={filters.exclude || []} onChange={(v) => updateFilter("exclude", v)} placeholder="e.g. Intern, Student" />
        </div>
        <div>
          <label className="text-base font-medium text-foreground">Seniority</label>
          <MultiSelectChips options={seniorityOptions} value={filters.seniority || []} onChange={(v) => updateFilter("seniority", v)} placeholder="Select seniority..." allowCustom={false} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Location" defaultOpen>
        <div>
          <label className="text-base font-medium text-foreground">Where should they live?</label>
          <MultiSelectChips options={[]} value={filters.location || []} onChange={(v) => updateFilter("location", v)} placeholder="e.g. Cairo, Egypt" />
        </div>
        <div className="pt-1 border-t space-y-3">
          <p className="text-sm font-semibold text-[var(--brand-deep)]">Filter the people shown on the right</p>
          <FacetList label="Country" values={facetsByKey.country.values} selected={selectedIn("country")} onToggle={(v) => onToggleFacet("country", v)} />
          <FacetList label="Region" values={facetsByKey.region.values} selected={selectedIn("region")} onToggle={(v) => onToggleFacet("region", v)} />
          <FacetList label="City" values={facetsByKey.city.values} selected={selectedIn("city")} onToggle={(v) => onToggleFacet("city", v)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Education">
        <p className="text-sm font-semibold text-[var(--brand-deep)]">Filter the people shown on the right</p>
        <FacetList label="Highest degree" values={facetsByKey.highestDegree.values} selected={selectedIn("highestDegree")} onToggle={(v) => onToggleFacet("highestDegree", v)} />
        <FacetList label="Field of study" values={facetsByKey.fieldsOfStudy.values} selected={selectedIn("fieldsOfStudy")} onToggle={(v) => onToggleFacet("fieldsOfStudy", v)} />
      </CollapsibleSection>

      <CollapsibleSection title="Experience">
        <div>
          <label className="text-base font-medium text-foreground">
            Search for years of experience ({filters.yearsMin ?? 0} - {filters.yearsMax ?? 20} yrs)
          </label>
          <div className="pt-4 px-2">
            <Slider
              value={[filters.yearsMin ?? 0, filters.yearsMax ?? 20]}
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
        <div className="pt-1 border-t space-y-3">
          <p className="text-sm font-semibold text-[var(--brand-deep)]">Filter the people shown on the right</p>
          <FacetList label="Years of experience" values={facetsByKey.yearsExperience.values} selected={selectedIn("yearsExperience")} onToggle={(v) => onToggleFacet("yearsExperience", v)} />
          <FacetList label="Seen before" values={facetsByKey.wasKnownBefore.values} selected={selectedIn("wasKnownBefore")} onToggle={(v) => onToggleFacet("wasKnownBefore", v)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Work style, industry & language">
        <div>
          <label className="text-base font-medium text-foreground">Work mode</label>
          <MultiSelectChips options={workModeOptions} value={filters.workMode || []} onChange={(v) => updateFilter("workMode", v)} placeholder="Select mode..." allowCustom={false} />
        </div>
        <div className="pt-1 border-t space-y-3">
          <p className="text-sm font-semibold text-[var(--brand-deep)]">Filter the people shown on the right</p>
          <FacetList label="Industry" values={facetsByKey.industry.values} selected={selectedIn("industry")} onToggle={(v) => onToggleFacet("industry", v)} />
          <FacetList label="Language" values={facetsByKey.languages.values} selected={selectedIn("languages")} onToggle={(v) => onToggleFacet("languages", v)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Where they came from">
        <p className="text-sm font-semibold text-[var(--brand-deep)]">Filter the people shown on the right</p>
        <FacetList label="Source" values={facetsByKey.source.values} selected={selectedIn("source")} onToggle={(v) => onToggleFacet("source", v)} />
      </CollapsibleSection>
    </div>
  );
}
