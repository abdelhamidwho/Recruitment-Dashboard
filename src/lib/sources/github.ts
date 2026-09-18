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
 * Mapping from SearchFilters -> GitHub query — REWORKED (2026-09-07) after
 * discovering that GitHub user search has no free-text OR: every free-text
 * term AND every qualifier in `q=` must ALL match the same profile. The
 * previous version ANDed every title plus every must-have skill, which
 * demanded one person whose bio contained three job titles verbatim and
 * five unrelated tools — an empty set for every realistic search. The
 * architecture now is **broad retrieval, precise ranking**: this function's
 * job is to fetch a plausible pool cheaply; `src/lib/scoring.ts` already
 * scores every returned candidate against the *full* filter set (titles,
 * mustHave, niceToHave, years, exclude, ...), so nothing needs to be — or
 * should be — re-verified in the query itself.
 *
 * - **Titles are alternatives, not conjuncts.** GitHub can't OR free text,
 *   so instead of ANDing every title (guaranteeing zero matches for any
 *   preset with more than one title) this uses only the FIRST title in
 *   `filters.titles` — role presets list their primary/most-specific title
 *   first (e.g. "Data Engineer" before "Data Analytics Engineer"), and
 *   scoring still credits a candidate for matching any of the others.
 * - **`mustHave` skills that are recognised programming languages** (see
 *   KNOWN_LANGUAGES) become `language:` qualifiers — genuinely selective and
 *   cheap (a user really does have a definite set of languages). Capped at
 *   MAX_LANGUAGE_QUALIFIERS (2): one language is very plausible, two is
 *   plausible (e.g. both SQL and Python repos), but every additional
 *   `language:` ANDed in multiplies how rare the combination is, so this
 *   takes only the first two encountered (in the order the caller listed
 *   them, i.e. already priority-ordered by the UI).
 * - **`mustHave` skills that are NOT a recognised language** (tools like
 *   Airflow, Snowflake, dbt) are DELIBERATELY LEFT OUT of the query
 *   entirely. They almost never appear verbatim in a GitHub bio, and ANDing
 *   them in empties the result set the same way titles used to. Scoring
 *   still matches them against the candidate's skills/summary — this is
 *   where they belong, as ranking signal, not a retrieval gate.
 * - **`niceToHave` skills never appear in the query at all**, in any form —
 *   including as a `language:` qualifier. They are preferences by
 *   definition; requiring them in retrieval is a category error. Scoring
 *   already rewards them; see `describeGithubRankOnlyFilters` below, which
 *   is how the UI tells the user these still influence ranking.
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
 * Maximum number of `language:` qualifiers emitted into the query. GitHub
 * ANDs qualifiers together, so each additional `language:` multiplies how
 * rare the combination is: one is common, two is plausible (e.g. someone
 * with both SQL and Python repos), three or more starts demanding a
 * specific, uncommon combination and tends toward zero results. Capped at
 * the first two languages found in `mustHave`, in the order supplied.
 */
export const MAX_LANGUAGE_QUALIFIERS = 2;

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
 *
 * See the module-level doc comment above for the full rationale. Summary:
 * only the first title (free text), at most MAX_LANGUAGE_QUALIFIERS
 * `language:` qualifiers drawn from `mustHave` (non-language mustHave terms
 * and all of `niceToHave` are left out of the query entirely — they still
 * feed scoring, just not retrieval), plus `location:` and `type:user`.
 */
export function buildGithubUserQuery(filters: Partial<SearchFilters>): string {
  const parts: string[] = ["type:user"];

  const title = (filters.titles || [])
    .map((t) => t?.trim?.())
    .find((t): t is string => Boolean(t));
  if (title) {
    parts.push(quoteIfSpace(title));
  }

  const languageQualifiers: string[] = [];
  for (const term of filters.mustHave || []) {
    if (languageQualifiers.length >= MAX_LANGUAGE_QUALIFIERS) break;
    const trimmed = term?.trim?.();
    if (!trimmed) continue;
    const asLanguage = languageQualifier(trimmed);
    if (asLanguage && !languageQualifiers.includes(asLanguage)) {
      languageQualifiers.push(asLanguage);
    }
  }
  parts.push(...languageQualifiers);

  const location = (filters.location || []).find((l) => typeof l === "string" && l.trim().length > 0);
  if (location) {
    parts.push(`location:${quoteIfSpace(location.trim())}`);
  }

  return parts.join(" ");
}

/**
 * Given the current filter values, describes which sub-filters this source
 * deliberately leaves out of retrieval (the `q=` query) but still relies on
 * scoring.ts to use for ranking. Distinct from `unsupportedFilterFields` on
 * `githubSource`, which lists filters GitHub has NO way to act on at all —
 * these, in contrast, actively influence which candidates rank highest,
 * they just aren't used to find them in the first place. Returns
 * human-readable fragments (not full sentences) for the UI to compose into
 * a note; empty when nothing is currently excluded this way.
 */
export function describeGithubRankOnlyFilters(filters: Partial<SearchFilters>): string[] {
  const notes: string[] = [];

  const niceToHave = (filters.niceToHave || []).map((s) => s?.trim?.()).filter((s): s is string => Boolean(s));
  if (niceToHave.length > 0) {
    notes.push(`nice-to-have skills (${niceToHave.join(", ")})`);
  }

  const nonLanguageMustHave = (filters.mustHave || [])
    .map((s) => s?.trim?.())
    .filter((s): s is string => Boolean(s))
    .filter((s) => !languageQualifier(s));
  if (nonLanguageMustHave.length > 0) {
    notes.push(`must-have skills GitHub can't search on directly (${nonLanguageMustHave.join(", ")})`);
  }

  return notes;
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
  // Mirrors the filter-mapping doc comment above `buildGithubUserQuery`:
  // these SearchFilters fields have no GitHub equivalent and are silently
  // ignored by buildGithubUserQuery, so the UI surfaces that explicitly.
  unsupportedFilterFields: [
    "yearsMin",
    "yearsMax",
    "workMode",
    "companySize",
    "industry",
    "education",
    "languages",
    "certifications",
    "targetCompanies",
    "excludedCompanies",
  ],
  describeRankOnlyFilters: describeGithubRankOnlyFilters,
  // Verified live against api.github.com (2026-09-07) — see the module doc
  // comment above for the specifics this restates in plain language for a
  // non-technical HR user.
  description: {
    searches:
      "Searches public GitHub user profiles: name, bio, company, location, and the programming " +
      "languages in their public repositories. It does not search LinkedIn, Indeed, or Glassdoor.",
    reliablyReturns: ["Name", "Avatar", "Bio (shown as headline/summary)", "Company", "Location", "Profile URL"],
    cannotProvide: [
      "Employment history or years of experience",
      "Education",
      "Spoken languages",
      "Industry",
      "Work mode (remote/hybrid/onsite)",
      "Salary",
      "Contact details beyond what the person has made public",
    ],
    cost: "Free — uses the official GitHub REST API.",
    setupAndLimits:
      "No setup required. Unauthenticated: about 60 requests/hour and 10 searches/minute. Adding a free " +
      "GitHub personal access token (no scopes needed) raises this to about 5,000 requests/hour.",
    readyNow: true,
    notes: [
      "Best suited to engineering roles.",
      "Location is free text people write inconsistently, so some candidates will have no parseable country.",
    ],
  },
  search: searchGithub,
};
