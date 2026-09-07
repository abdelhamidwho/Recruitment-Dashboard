import { Candidate } from "@/lib/apify";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { CandidateSource, SourceSearchOptions } from "./types";

/**
 * GitHub REST API candidate source.
 *
 * Verified live against api.github.com (2026-09-07):
 * - GET /search/users returns only sparse per-hit fields (login, id, avatar_url,
 *   html_url, score, ...) — no name, location, company, or bio. A second
 *   GET /users/{login} per hit is required to populate a useful candidate.
 *   Confirmed by inspecting a real response: the search hit for "khaledhosny"
 *   carries none of those fields, while GET /users/khaledhosny returns
 *   name, company, location, bio, blog, followers, public_repos, etc.
 * - location:, language:, followers:>N, repos:>N, type:user, in:login,
 *   in:name, in:email are all real, documented qualifiers and were exercised
 *   live (e.g. `location:Cairo language:Python type:user` returned 2000+ hits).
 * - Unauthenticated requests: GET /rate_limit showed the search resource
 *   capped at 10/min (X-RateLimit-Resource: search, X-RateLimit-Limit: 10),
 *   core (used for the per-user follow-up lookups) at 60/hour — matching the
 *   brief. A GITHUB_TOKEN raises both substantially (documented by GitHub as
 *   30/min search, 5000/hour core for authenticated requests).
 *
 * Mapping from SearchFilters -> GitHub query (documented here since GitHub's
 * query qualifiers don't line up one-to-one with the shared filter shape):
 * - `titles` and `mustHave`/`niceToHave` skills that are NOT recognised
 *   programming languages become free-text query terms (GitHub ANDs them,
 *   matching against login/name by default).
 * - `mustHave`/`niceToHave` entries that ARE recognised programming languages
 *   (see KNOWN_LANGUAGES) become `language:` qualifiers instead — GitHub has
 *   no concept of a "skill", only languages a user has pushed code in.
 * - `location[0]` (only the first — GitHub qualifiers AND together, so
 *   multiple `location:` terms would require a user to match all of them
 *   at once, which is not what "any of these locations" means) becomes
 *   `location:"..."`.
 * - `exclude` cannot be expressed as a query qualifier (GitHub does not
 *   support excluding free-text terms), so it is applied client-side after
 *   fetching full profiles, checked against bio/name/company/login.
 * - `yearsMin`/`yearsMax`/`workMode`/`companySize`/`industry`/`education`/
 *   `languages` (spoken)/`certifications`/`targetCompanies`/
 *   `excludedCompanies` have no GitHub equivalent and are intentionally not
 *   mapped to anything — GitHub has no data to filter on for them.
 */

const SEARCH_USERS_URL = "https://api.github.com/search/users";
const USER_URL = (login: string) => `https://api.github.com/users/${encodeURIComponent(login)}`;

/** Conservative default so a first, tokenless run cannot burn the whole
 * unauthenticated hourly core budget (60/hour, one request per candidate for
 * the enrichment lookup, plus one search request). */
export const DEFAULT_LIMIT = 10;
/** Hard ceiling regardless of what a caller requests. */
export const MAX_LIMIT = 30;

/**
 * Small, deliberately partial set of languages GitHub's `language:` qualifier
 * recognises, used only to decide whether a skill term should become a
 * `language:` qualifier instead of a free-text term. Not exhaustive by
 * design — an unrecognised term simply falls back to free text, which still
 * works (just less precisely) rather than being dropped.
 */
export const KNOWN_LANGUAGES = new Set(
  [
    "javascript", "typescript", "python", "java", "go", "golang", "rust", "c", "c++", "c#",
    "ruby", "php", "swift", "kotlin", "scala", "r", "dart", "elixir", "clojure", "haskell",
    "shell", "html", "css", "vue", "objective-c", "perl", "lua", "sql",
  ].map((l) => l.toLowerCase()),
);

function languageQualifier(term: string): string | null {
  const normalized = term.trim().toLowerCase();
  if (normalized === "golang") return "language:go";
  if (normalized === "c++") return "language:c++";
  if (normalized === "c#") return "language:c#";
  return KNOWN_LANGUAGES.has(normalized) ? `language:${normalized}` : null;
}

function quoteIfSpace(term: string): string {
  return term.includes(" ") ? `"${term}"` : term;
}

/**
 * Builds the `q=` query string for GET /search/users from shared
 * SearchFilters. Pure and side-effect free so it is unit-testable without
 * network access. Never throws — every field is optional/defaulted.
 */
export function buildGithubUserQuery(filters: Partial<SearchFilters>): string {
  const parts: string[] = ["type:user"];
  const freeText: string[] = [];
  const qualifiers: string[] = [];

  const skillTerms = [...(filters.titles || []), ...(filters.mustHave || []), ...(filters.niceToHave || [])];
  for (const term of skillTerms) {
    const trimmed = term?.trim?.();
    if (!trimmed) continue;
    const asLanguage = languageQualifier(trimmed);
    if (asLanguage) {
      qualifiers.push(asLanguage);
    } else {
      freeText.push(quoteIfSpace(trimmed));
    }
  }

  const location = (filters.location || []).find((l) => typeof l === "string" && l.trim().length > 0);
  if (location) {
    qualifiers.push(`location:${quoteIfSpace(location.trim())}`);
  }

  parts.push(...freeText, ...qualifiers);
  return parts.join(" ");
}

/** Sparse per-hit shape returned by GET /search/users. */
interface SearchHit {
  login: string;
  id?: number;
}

/**
 * Parses a GET /search/users response body into the sparse hits it actually
 * contains. Never throws: a non-object body, a missing/non-array `items`, or
 * non-object/malformed elements are all treated as "no usable hits".
 */
export function parseSearchHits(body: unknown): SearchHit[] {
  if (typeof body !== "object" || body === null) return [];
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  const hits: SearchHit[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const login = (item as Record<string, unknown>).login;
    if (typeof login === "string" && login.length > 0) {
      hits.push({ login });
    }
  }
  return hits;
}

/**
 * Maps a GET /users/{login} response into the shared Candidate shape.
 * Never throws on malformed/missing fields — every read is guarded, matching
 * the standard set by src/lib/normalize/*.
 *
 * Fields GitHub genuinely cannot provide (headline, currentTitle, summary as
 * distinct from bio-as-headline, skills, experience, education, languages,
 * certifications, totalYearsExperience) are left absent/empty rather than
 * guessed — see `unsupportedFields` on the exported source.
 */
export function mapGithubUserToCandidate(user: unknown): Candidate | null {
  if (typeof user !== "object" || user === null) return null;
  const u = user as Record<string, unknown>;

  const login = typeof u.login === "string" ? u.login : undefined;
  const htmlUrl = typeof u.html_url === "string" ? u.html_url : undefined;
  if (!login && !htmlUrl) return null;

  const name = typeof u.name === "string" && u.name.trim() ? u.name.trim() : undefined;
  const bio = typeof u.bio === "string" ? u.bio : undefined;
  const company = typeof u.company === "string" ? u.company.replace(/^@/, "").trim() : undefined;

  return {
    externalId: typeof u.id === "number" || typeof u.id === "string" ? String(u.id) : (login as string),
    fullName: name || login || "",
    headline: bio,
    currentTitle: undefined, // GitHub has no job-title field
    currentCompany: company || undefined,
    location: typeof u.location === "string" && u.location.trim() ? u.location.trim() : undefined,
    profileUrl: htmlUrl || `https://github.com/${login}`,
    avatarUrl: typeof u.avatar_url === "string" ? u.avatar_url : undefined,
    summary: bio,
    industry: undefined, // GitHub has no industry field
    skills: [], // GitHub has no explicit skills list; language: qualifiers filter, not enrich
    experience: [], // no employment history available
    education: [], // no education data available
    languages: [], // "languages" here would mean spoken languages, which GitHub doesn't expose
    certifications: [],
    totalYearsExperience: undefined, // deliberately absent, not 0 — see scoring.ts fix
    raw: user,
  };
}

/** Builds the actionable rate-limit error message for a 403/429 response. */
export function formatRateLimitError(resource: string, resetHeader: string | null): string {
  let resetText = "an unknown time";
  if (resetHeader) {
    const resetSeconds = Number(resetHeader);
    if (Number.isFinite(resetSeconds)) {
      resetText = new Date(resetSeconds * 1000).toISOString();
    }
  }
  return (
    `GitHub API rate limit exceeded for the "${resource}" resource. ` +
    `Limit resets at ${resetText}. Set GITHUB_TOKEN in the environment to raise the limit ` +
    `(unauthenticated search is capped at 10 requests/minute, 60/hour core).`
  );
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch(url: string, token: string | undefined): Promise<unknown> {
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 403 || res.status === 429) {
    const resource = res.headers.get("x-ratelimit-resource") || "core";
    const reset = res.headers.get("x-ratelimit-reset");
    throw new Error(formatRateLimitError(resource, reset));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API error: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  return res.json();
}

/**
 * Filters out candidates whose name/headline/company mention an excluded
 * keyword. Applied after enrichment because the search hit alone doesn't
 * carry enough text to check against.
 */
export function applyExcludeFilter(candidates: Candidate[], exclude: string[]): Candidate[] {
  const terms = (exclude || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return candidates;
  return candidates.filter((c) => {
    const haystack = [c.fullName, c.headline, c.summary, c.currentCompany]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase();
    return !terms.some((term) => haystack.includes(term));
  });
}

async function searchGithub(filters: Partial<SearchFilters>, options?: SourceSearchOptions): Promise<Candidate[]> {
  const token = options?.token ?? process.env.GITHUB_TOKEN;
  const mode = token ? "authenticated" : "unauthenticated";
  console.info(`[sources/github] running in ${mode} mode`);

  const requestedLimit = filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  const query = buildGithubUserQuery(filters);
  const searchUrl = `${SEARCH_USERS_URL}?q=${encodeURIComponent(query)}&per_page=${limit}`;
  const searchBody = await githubFetch(searchUrl, token);
  const hits = parseSearchHits(searchBody).slice(0, limit);

  const candidates: Candidate[] = [];
  for (const hit of hits) {
    const userBody = await githubFetch(USER_URL(hit.login), token);
    const candidate = mapGithubUserToCandidate(userBody);
    if (candidate) candidates.push(candidate);
  }

  return applyExcludeFilter(candidates, filters.exclude || []);
}

export const githubSource: CandidateSource = {
  id: "github",
  label: "GitHub",
  unsupportedFields: [
    "currentTitle",
    "industry",
    "skills",
    "experience",
    "education",
    "languages",
    "certifications",
    "totalYearsExperience",
  ],
  search: searchGithub,
};
