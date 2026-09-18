import type { NormalizedProfile } from "@/lib/normalize";
import { canonicalCountry, regionForCountry } from "@/lib/normalize/regions";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";

/**
 * Location is OR across `filters.location` (any requested location is
 * acceptable), matched against the candidate's normalized city, country,
 * and region — not the raw free-text string, so "Cairo" matches a
 * candidate located in "Cairo, Egypt" and "UAE" matches one in "Dubai"
 * (same region/country) without demanding an exact string match.
 *
 * A single requested entry may itself be a comma-separated place
 * ("Cairo, Egypt" as one chip, rather than two) — real search data has
 * both shapes. Each requested entry is therefore split on commas into
 * candidate segments (plus the whole string) and any segment matching
 * counts, so "Cairo, Egypt" still matches a candidate whose city is
 * "Cairo" even though the requested string as a whole is neither the
 * bare city nor the bare country.
 *
 * Falls back to a case-insensitive substring check against the raw
 * location when normalization couldn't parse it (e.g. an unrecognised
 * place name) — better than scoring every unparsed location as a miss.
 */
export function scoreLocation(normalized: NormalizedProfile, filters: Partial<SearchFilters>): RuleResult {
  const requested = (filters.location ?? []).map((l) => l?.trim()).filter((l): l is string => Boolean(l));
  if (requested.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const { city, country, region, raw } = normalized.location;

  const matchesSegment = (segment: string): boolean => {
    const canonical = canonicalCountry(segment) ?? segment;
    const canonicalRegion = regionForCountry(canonical);
    const lower = segment.toLowerCase();

    if (city && city.toLowerCase() === lower) return true;
    if (country && (country.toLowerCase() === lower || country === canonical)) return true;
    if (region && (region.toLowerCase() === lower || region === canonicalRegion)) return true;
    if (!city && !country && raw && raw.toLowerCase().includes(lower)) return true;
    return false;
  };

  const match = requested.find((loc) => {
    const segments = [loc, ...loc.split(",").map((s) => s.trim())].filter(Boolean);
    return segments.some(matchesSegment);
  });

  if (match) {
    return {
      earned: WEIGHTS.location,
      maxPoints: WEIGHTS.location,
      evidence: [{ label: `Based in ${raw ?? "a requested location"} (matches "${match}")`, points: WEIGHTS.location }],
    };
  }

  return {
    earned: 0,
    maxPoints: WEIGHTS.location,
    evidence: [
      {
        label: raw ? `Located in ${raw}, not a requested location (${requested.join(", ")})` : "Location unknown",
        points: 0,
      },
    ],
  };
}
