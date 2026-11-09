export interface SearchFilters {
  rolePreset?: string;
  seniority: string[];
  mustHave: string[];
  niceToHave: string[];
  exclude: string[];
  yearsMin: number;
  yearsMax: number;
  location: string[];
  workMode: string[];
  titles: string[];
  targetCompanies: string[];
  excludedCompanies: string[];
  industry: string[];
  companySize: string[];
  education?: string;
  languages: string[];
  certifications: string[];
  limit: number;
  /** Portals for the Google-based source: ids from XRAY_PORTALS (default: LinkedIn only). */
  portals?: string[];
}

export function buildBooleanQuery(filters: Partial<SearchFilters>): string {
  const parts: string[] = [];

  const quoteIfSpace = (str: string) => (str.includes(" ") ? `"${str}"` : str);
  const dedupe = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean);

  // 1. Titles
  const titles = dedupe(filters.titles || []);
  if (titles.length > 0) {
    if (titles.length === 1) {
      parts.push(quoteIfSpace(titles[0]));
    } else {
      parts.push(`(${titles.map(quoteIfSpace).join(" OR ")})`);
    }
  }

  // 2. Must-have skills
  const mustHave = dedupe(filters.mustHave || []);
  if (mustHave.length > 0) {
    mustHave.forEach((skill) => {
      parts.push(quoteIfSpace(skill));
    });
  }

  // 3. Nice-to-have skills
  const niceToHave = dedupe(filters.niceToHave || []);
  if (niceToHave.length > 0) {
    if (niceToHave.length === 1) {
      parts.push(quoteIfSpace(niceToHave[0]));
    } else {
      parts.push(`(${niceToHave.map(quoteIfSpace).join(" OR ")})`);
    }
  }

  // 4. Target Companies
  const targetCompanies = dedupe(filters.targetCompanies || []);
  if (targetCompanies.length > 0) {
    if (targetCompanies.length === 1) {
      parts.push(quoteIfSpace(targetCompanies[0]));
    } else {
      parts.push(`(${targetCompanies.map(quoteIfSpace).join(" OR ")})`);
    }
  }

  // 5. Excluded terms and companies
  const excluded = dedupe([...(filters.exclude || []), ...(filters.excludedCompanies || [])]);
  if (excluded.length > 0) {
    excluded.forEach((term) => {
      parts.push(`NOT ${quoteIfSpace(term)}`);
    });
  }

  return parts.join(" AND ").replace(/ AND NOT /g, " NOT ");
}
