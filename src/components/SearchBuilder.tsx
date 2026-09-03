"use client";

import * as React from "react";
import { MultiSelectChips, Option } from "./MultiSelectChips";
import { buildBooleanQuery, SearchFilters } from "@/lib/buildBooleanQuery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ResultsTable, ResultCandidate } from "./ResultsTable";

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

  // Auto-update query preview when filters change (if not overridden by user)
  React.useEffect(() => {
    if (!isCustom) {
      setCustomQuery(buildBooleanQuery(filters));
    }
  }, [filters, isCustom]);

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

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchStatus("Starting Apify run...");
    setCurrentRunId("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Poll
      const searchRunId = data.searchRunId;
      setCurrentRunId(searchRunId);
      let status = "RUNNING";
      while (status === "RUNNING" || status === "READY") {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/search/${searchRunId}`);
        const pollData = await pollRes.json();
        if (pollData.error) throw new Error(pollData.error);
        status = pollData.status;
        setSearchStatus(`Status: ${status}...`);
        
        if (status === "SUCCEEDED") {
          setSearchResults(pollData.candidates || []);
          setSearchStatus("Done!");
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
              <h2 className="text-lg font-semibold">Boolean Preview</h2>
              <Badge variant="secondary">{activeFiltersCount} filters</Badge>
            </div>
            <Textarea
              value={customQuery}
              onChange={(e) => {
                setCustomQuery(e.target.value);
                setIsCustom(true);
              }}
              className="h-40 font-mono text-sm"
              placeholder="Boolean string will appear here..."
            />
            {isCustom && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                Custom query mode active
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button className="w-full" size="lg" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Searching..." : "Search LinkedIn"}
            </Button>
            {searchStatus && <p className="text-xs text-center text-muted-foreground">{searchStatus}</p>}
            <Button variant="outline" className="w-full" onClick={() => {
              setFilters({ yearsMin: 0, yearsMax: 20, limit: 50 });
              setIsCustom(false);
              setSearchResults([]);
              setCurrentRunId("");
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
    </div>
  );
}
