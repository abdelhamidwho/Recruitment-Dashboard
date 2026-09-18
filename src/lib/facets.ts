/**
 * Pure facet computation over a set of already-fetched candidates.
 *
 * This intentionally does NOT touch Prisma or SQL groupBy — see
 * docs/superpowers/plans/2026-09-02-phase-1-foundation.md Task 19's closing
 * note: SQLite groupBy is byte-for-byte (so "Egypt"/"egypt" would split),
 * and `fieldsOfStudy`/`languages` are JSON-encoded arrays that groupBy can't
 * see inside at all. Facets are computed here, in application code, over
 * the candidates already returned for one search run — this is deliberate:
 * counts must describe the current result set, not the whole database.
 */

/** The minimal candidate shape the facet computation needs. */
export interface FacetableCandidate {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  industry?: string | null;
  highestDegree?: string | null;
  fieldsOfStudy?: string | null; // JSON string array
  languages?: string | null; // JSON array of { name, level }
  source?: string | null;
  totalYearsExperience?: number | null;
  wasKnownBefore?: boolean | null;
}

/** Sentinel value used for the "not specified" bucket, and its display label. */
export const NOT_SPECIFIED = "__NOT_SPECIFIED__";
export const NOT_SPECIFIED_LABEL = "Not specified";

export interface FacetValue {
  /** Grouping key: lower-cased for text dimensions, or NOT_SPECIFIED. */
  value: string;
  /** Readable label to display, preserving a real casing when available. */
  label: string;
  count: number;
}

export interface FacetGroupResult {
  key: FacetDimension;
  values: FacetValue[];
}

export type FacetDimension =
  | "country"
  | "region"
  | "city"
  | "industry"
  | "highestDegree"
  | "fieldsOfStudy"
  | "languages"
  | "source"
  | "yearsExperience"
  | "wasKnownBefore";

export const FACET_DIMENSIONS: FacetDimension[] = [
  "country",
  "region",
  "city",
  "industry",
  "highestDegree",
  "fieldsOfStudy",
  "languages",
  "source",
  "yearsExperience",
  "wasKnownBefore",
];

/** Years-of-experience buckets, in display order. */
export const YEARS_BUCKETS: { key: string; label: string; test: (y: number) => boolean }[] = [
  { key: "0-2", label: "0-2 yrs", test: (y) => y >= 0 && y < 3 },
  { key: "3-5", label: "3-5 yrs", test: (y) => y >= 3 && y < 6 },
  { key: "6-9", label: "6-9 yrs", test: (y) => y >= 6 && y < 10 },
  { key: "10-14", label: "10-14 yrs", test: (y) => y >= 10 && y < 15 },
  { key: "15+", label: "15+ yrs", test: (y) => y >= 15 },
];

function bucketForYears(y: number): { key: string; label: string } {
  const bucket = YEARS_BUCKETS.find((b) => b.test(y));
  return bucket ? { key: bucket.key, label: bucket.label } : { key: NOT_SPECIFIED, label: NOT_SPECIFIED_LABEL };
}

/** Safely parses a JSON string array; returns [] on any parse failure or non-array. */
function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

interface LanguageEntry {
  name?: string;
  level?: string;
}

/** Safely parses the languages JSON array of {name, level}. */
function parseLanguages(raw: string | null | undefined): LanguageEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is LanguageEntry => v && typeof v === "object");
  } catch {
    return [];
  }
}

/**
 * Tally for a single-value text dimension (country, region, city, industry,
 * highestDegree, source). Groups case-insensitively; the displayed label is
 * the first-seen original-cased value for that group.
 */
function tallyScalar(values: (string | null | undefined)[]): FacetValue[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const trimmed = raw?.trim();
    const key = trimmed ? trimmed.toLowerCase() : NOT_SPECIFIED;
    const label = trimmed ? trimmed : NOT_SPECIFIED_LABEL;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { label, count: 1 });
    }
  }
  return Array.from(counts.entries())
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Tally for a dimension where each candidate may contribute zero or more
 * values (fieldsOfStudy, languages) — a candidate with no values counts once
 * toward NOT_SPECIFIED, and a candidate with N values counts once toward each
 * of the N group buckets (so a multi-field candidate isn't lost, but also
 * isn't required to have exactly one value).
 */
function tallyMultiValue(perCandidateValues: string[][]): FacetValue[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const values of perCandidateValues) {
    const cleaned = values.map((v) => v.trim()).filter((v) => v.length > 0);
    if (cleaned.length === 0) {
      const existing = counts.get(NOT_SPECIFIED);
      counts.set(NOT_SPECIFIED, { label: NOT_SPECIFIED_LABEL, count: (existing?.count ?? 0) + 1 });
      continue;
    }
    // A candidate contributing the same value twice (e.g. "Python" listed
    // twice) should only count once for that candidate.
    const seenForThisCandidate = new Set<string>();
    for (const v of cleaned) {
      const key = v.toLowerCase();
      if (seenForThisCandidate.has(key)) continue;
      seenForThisCandidate.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { label: v, count: 1 });
      }
    }
  }
  return Array.from(counts.entries())
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function tallyYears(values: (number | null | undefined)[]): FacetValue[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const y of values) {
    const { key, label } = typeof y === "number" && !Number.isNaN(y) ? bucketForYears(y) : { key: NOT_SPECIFIED, label: NOT_SPECIFIED_LABEL };
    const existing = counts.get(key);
    counts.set(key, { label, count: (existing?.count ?? 0) + 1 });
  }
  // Preserve bucket display order rather than count order, since these are
  // ordinal (0-2 before 3-5 before ...), with NOT_SPECIFIED last.
  const order = [...YEARS_BUCKETS.map((b) => b.key), NOT_SPECIFIED];
  return order
    .filter((key) => counts.has(key))
    .map((key) => ({ value: key, ...counts.get(key)! }));
}

function tallyBoolean(values: (boolean | null | undefined)[], trueLabel: string, falseLabel: string): FacetValue[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const v of values) {
    const key = v === true ? "true" : v === false ? "false" : NOT_SPECIFIED;
    const label = v === true ? trueLabel : v === false ? falseLabel : NOT_SPECIFIED_LABEL;
    const existing = counts.get(key);
    counts.set(key, { label, count: (existing?.count ?? 0) + 1 });
  }
  const order = ["true", "false", NOT_SPECIFIED];
  return order
    .filter((key) => counts.has(key))
    .map((key) => ({ value: key, ...counts.get(key)! }));
}

/** Computes all facet groups over the given candidates. */
export function computeFacets(candidates: FacetableCandidate[]): FacetGroupResult[] {
  return FACET_DIMENSIONS.map((key) => ({ key, values: computeFacetValues(candidates, key) }));
}

export function computeFacetValues(candidates: FacetableCandidate[], dimension: FacetDimension): FacetValue[] {
  switch (dimension) {
    case "country":
      return tallyScalar(candidates.map((c) => c.country));
    case "region":
      return tallyScalar(candidates.map((c) => c.region));
    case "city":
      return tallyScalar(candidates.map((c) => c.city));
    case "industry":
      return tallyScalar(candidates.map((c) => c.industry));
    case "highestDegree":
      return tallyScalar(candidates.map((c) => c.highestDegree));
    case "source":
      return tallyScalar(candidates.map((c) => c.source));
    case "fieldsOfStudy":
      return tallyMultiValue(candidates.map((c) => parseStringArray(c.fieldsOfStudy)));
    case "languages":
      return tallyMultiValue(
        candidates.map((c) =>
          parseLanguages(c.languages)
            .map((l) => (l.name ? `${l.name}${l.level ? ` (${l.level})` : ""}` : ""))
            .filter((v) => v.length > 0),
        ),
      );
    case "yearsExperience":
      return tallyYears(candidates.map((c) => c.totalYearsExperience));
    case "wasKnownBefore":
      return tallyBoolean(candidates.map((c) => c.wasKnownBefore), "Seen before", "New");
    default:
      return [];
  }
}

/** Selected facet values per dimension: dimension -> set of selected `value` keys. */
export type FacetSelection = Partial<Record<FacetDimension, string[]>>;

/** Whether a candidate matches a value key within one dimension. */
function candidateMatchesDimension(candidate: FacetableCandidate, dimension: FacetDimension, key: string): boolean {
  switch (dimension) {
    case "country":
    case "region":
    case "city":
    case "industry":
    case "highestDegree":
    case "source": {
      const raw = (candidate[dimension] as string | null | undefined)?.trim();
      const candidateKey = raw ? raw.toLowerCase() : NOT_SPECIFIED;
      return candidateKey === key;
    }
    case "fieldsOfStudy": {
      const values = parseStringArray(candidate.fieldsOfStudy);
      if (values.length === 0) return key === NOT_SPECIFIED;
      return values.some((v) => v.trim().toLowerCase() === key);
    }
    case "languages": {
      const values = parseLanguages(candidate.languages)
        .map((l) => (l.name ? `${l.name}${l.level ? ` (${l.level})` : ""}` : ""))
        .filter((v) => v.length > 0);
      if (values.length === 0) return key === NOT_SPECIFIED;
      return values.some((v) => v.toLowerCase() === key);
    }
    case "yearsExperience": {
      const y = candidate.totalYearsExperience;
      const bucketKey = typeof y === "number" && !Number.isNaN(y) ? bucketForYears(y).key : NOT_SPECIFIED;
      return bucketKey === key;
    }
    case "wasKnownBefore": {
      const boolKey = candidate.wasKnownBefore === true ? "true" : candidate.wasKnownBefore === false ? "false" : NOT_SPECIFIED;
      return boolKey === key;
    }
    default:
      return false;
  }
}

/**
 * Computes facet groups the way a facet rail should display them: each
 * dimension's counts are computed over candidates filtered by every OTHER
 * dimension's selection (but not its own). This keeps every value in a
 * facet visible with an up-to-date count even after the user has selected
 * one of that facet's own values — otherwise selecting "Egypt" would filter
 * the country list down to just "Egypt", making it impossible to see (or
 * add) "UAE" as a second "any of these" choice. The results list itself
 * still applies the FULL selection (see applyFacetSelection) — only the
 * facet counts shown alongside each group are computed this way.
 */
export function computeFacetsForDisplay<T extends FacetableCandidate>(
  candidates: T[],
  selection: FacetSelection,
): FacetGroupResult[] {
  return FACET_DIMENSIONS.map((dim) => {
    const otherSelection: FacetSelection = { ...selection };
    delete otherSelection[dim];
    const filtered = applyFacetSelection(candidates, otherSelection);
    return { key: dim, values: computeFacetValues(filtered, dim) };
  });
}

/**
 * Applies a facet selection to a candidate list: within one dimension,
 * selected values combine as OR ("any of these"); across dimensions,
 * selections combine as AND ("all of these"). A dimension with no
 * selections imposes no constraint.
 */
export function applyFacetSelection<T extends FacetableCandidate>(candidates: T[], selection: FacetSelection): T[] {
  const activeDimensions = (Object.keys(selection) as FacetDimension[]).filter(
    (dim) => (selection[dim]?.length ?? 0) > 0,
  );
  if (activeDimensions.length === 0) return candidates;
  return candidates.filter((candidate) =>
    activeDimensions.every((dim) => {
      const keys = selection[dim] ?? [];
      return keys.some((key) => candidateMatchesDimension(candidate, dim, key));
    }),
  );
}
