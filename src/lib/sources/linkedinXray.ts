import { Candidate } from "@/lib/apify";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { canonicalLinkedInUrl, toCandidate } from "@/lib/linkedinImport";
import skillsTaxonomy from "@/data/skills.json";
import { CandidateSource, SourceSearchOptions } from "./types";

export type XrayProvider = "serper" | "serpapi" | "google";

/**
 * LinkedIn "X-ray" source: finds public LinkedIn profile URLs through Google's
 * official Programmable Search API (free: 100 queries/day, 10 results each) and
 * reads the title/snippet the search engine already shows. It never requests
 * linkedin.com and never logs in, so there is no LinkedIn account at risk.
 *
 * The trade-off is thin data: a search result carries a name, headline and
 * sometimes a location — no skills, experience or education. Those fields are
 * declared unsupported so scoring skips them instead of penalising (or
 * hard-gating) people on data this source can never supply.
 *
 * Needs ONE search-API key, checked in this order: SERPER_API_KEY (serper.dev,
 * 2,500 free searches), SERPAPI_KEY (serpapi.com, small free monthly plan), or
 * GOOGLE_API_KEY + GOOGLE_CSE_ID (Google Programmable Search — closed to new
 * customers, kept for anyone who already has access). Mirrors
 * scripts/linkedin_xray.py.
 */

const CSE_URL = "https://www.googleapis.com/customsearch/v1";
const PAGE_SIZE = 10;
const DEFAULT_LIMIT = 20;
// Up to 5 pages (50 results) per title; each page is one free search credit.
const MAX_LIMIT = 50;
const MAX_SKILL_TERMS = 3;
const MAX_PAGES = 5;
// Title variants searched per request (e.g. "Android Engineer" and "Kotlin Developer").
const MAX_TITLE_VARIANTS = 3;

export const MISSING_KEYS_MESSAGE =
  "LinkedIn (X-ray) needs a search-API key. Set SERPER_API_KEY (free at serper.dev) or SERPAPI_KEY in " +
  ".env (see README.md), then restart the server.";

/** First provider whose credentials are present, or null. */
export function pickProvider(env: Record<string, string | undefined> = process.env): XrayProvider | null {
  if (env.SERPER_API_KEY) return "serper";
  if (env.SERPAPI_KEY) return "serpapi";
  if (env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID) return "google";
  return null;
}

const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

/**
 * Portals the Google-based search can reach. Only sites whose profile pages
 * Google actually indexes for candidates are listed (checked with real
 * searches); Indeed and Glassdoor are shown in the UI as unavailable.
 */
export const XRAY_PORTALS = [
  { id: "linkedin", label: "LinkedIn", site: "linkedin.com/in" },
  { id: "bayt", label: "Bayt", site: "people.bayt.com/profile" },
  { id: "xing", label: "Xing", site: "xing.com/profile" },
  { id: "stackoverflow", label: "Stack Overflow", site: "stackoverflow.com/users" },
  { id: "behance", label: "Behance", site: "behance.net" },
] as const;
export type XrayPortalId = (typeof XRAY_PORTALS)[number]["id"];

export const UNAVAILABLE_PORTALS = [
  { id: "indeed", label: "Indeed", reason: "Resumes need an Indeed employer account; Google does not index them." },
  { id: "glassdoor", label: "Glassdoor", reason: "Glassdoor holds company reviews and salaries, not candidate profiles." },
] as const;

/** Valid portal ids from the request, defaulting to LinkedIn only. */
export function selectedPortals(raw: unknown): XrayPortalId[] {
  const known = new Set<string>(XRAY_PORTALS.map((p) => p.id));
  const picked = Array.isArray(raw) ? raw.filter((p): p is XrayPortalId => typeof p === "string" && known.has(p)) : [];
  return picked.length > 0 ? [...new Set(picked)] : ["linkedin"];
}

/** `site:linkedin.com/in "Title" "Location" "Skill" -"Excluded"` */
export function buildXrayQuery(filters: Partial<SearchFilters>, site = "linkedin.com/in"): string {
  const parts = [`site:${site}`];
  // Titles are alternatives; like GitHub, search the primary (first) one only.
  const title = filters.titles?.[0];
  if (title) parts.push(quote(title));
  const location = filters.location?.[0];
  if (location) parts.push(quote(location));
  for (const skill of (filters.mustHave ?? []).slice(0, MAX_SKILL_TERMS)) parts.push(quote(skill));
  for (const word of filters.exclude ?? []) parts.push(`-${quote(word)}`);
  return parts.join(" ");
}

const JOB_WORDS = /(engineer|developer|manager|analyst|architect|lead|specialist|designer|consultant|director|scientist)/i;
const BIDI = /[\u200e\u200f\u202a-\u202e]/g;

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Known skills (from the app's own taxonomy) that can be spotted in a title/snippet.
// Names of 3 letters or fewer must match case-exactly so "Go" / "R" don't fire on ordinary words.
const SKILL_MATCHERS: { name: string; re: RegExp }[] = [
  ...new Set((skillsTaxonomy as { skills: string[] }[]).flatMap((c) => c.skills)),
]
  .filter((name) => name.length >= 3)
  .map((name) => ({
    name,
    re: new RegExp(`(?<![A-Za-z0-9+#.])${escapeRe(name)}(?![A-Za-z0-9+#])`, name.length <= 3 ? "" : "i"),
  }));

export function detectSkills(text: string): string[] {
  return SKILL_MATCHERS.filter((m) => m.re.test(text)).map((m) => m.name);
}

/** Drops the "..." / "…" Google leaves where it truncated a company name. */
function cleanCompany(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const c = raw.replace(/\s*(?:\.{2,}|…).*$/, "").replace(/[\s,;:\-–·|•]+$/, "").trim();
  return c.length >= 2 ? c : undefined;
}

/**
 * Google rarely prints a location field, but it matched the page against the
 * location in the query. When the snippet or title names that place, report it
 * (with the city in front when the text gives one, e.g. "Cairo, Egypt").
 */
export function inferLocation(text: string, wanted?: string): string | undefined {
  const place = wanted?.trim();
  if (!place) return undefined;
  const lower = text.toLowerCase();
  const needle = place.toLowerCase();
  let firstPlain: string | undefined;
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
    const named = text.slice(at, at + place.length);
    const before = text.slice(0, at);
    // A city is only taken from capitalised words right before "..., <place>" — matched
    // case-sensitively, so ordinary words ("from", "in") are never pulled in.
    const city = /([A-Z][\w'’-]+(?:\s[A-Z][\w'’-]+){0,2}),\s*$/.exec(before);
    if (city) return `${city[1]}, ${named}`;
    // "Telecom Egypt" is a company name, not a place: skip mentions glued to a capitalised word.
    if (!firstPlain && !/[A-Z][\w'’-]*\s$/.test(before)) firstPlain = named;
  }
  return firstPlain;
}

/** Maps one search result ("Jane Doe - Senior Data Engineer - Acme | LinkedIn") to a Candidate. */
export function resultToCandidate(
  link: string,
  title: string,
  snippet: string,
  opts: { location?: string } = {},
): Candidate | null {
  const profileUrl = canonicalLinkedInUrl(link);
  if (!profileUrl) return null;
  const clean = title.replace(BIDI, "").replace(/\s*[|\-–]\s*LinkedIn\s*$/i, "").trim();
  const bits = clean.split(/\s+[-–|]\s+/).map((b) => b.trim()).filter(Boolean);
  if (bits.length === 0) return null;
  const text = snippet.replace(BIDI, "").replace(/\s+/g, " ").trim();
  const headline = bits.slice(1).join(" | ") || undefined;

  // Title is the first headline part; company only when it is stated as "X at Company" / "@ Company",
  // or in the snippet's "Experience: Company" field. Guessing from "A | B" produced skills as companies.
  const first = bits[1] ?? "";
  const at = first.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  const currentTitle = (at ? at[1] : first).split(/\s+[·|]\s+|\s+\(/)[0].replace(/\.{3}|…/g, "").trim() || undefined;
  const exp = text.match(/Experience:\s*([^·|]+?)\s*(?:·|\||$)/i);
  // Google often opens the snippet with "Senior Android Engineer at Company · ...".
  const snippetAt = text.match(/^[^·|•]{3,90}?\s(?:at|@)\s+([^·|•]{2,60}?)(?:\s*[·|•]|\.\s|$)/i);
  const currentCompany = cleanCompany(at?.[2]) ?? cleanCompany(exp?.[1]) ?? cleanCompany(snippetAt?.[1]);

  // Snippets often start "Cairo, Egypt · Senior Data Engineer ·". Only trust a "City, Country"-shaped
  // first segment that doesn't read like a job title.
  const locMatch = text.match(/^([A-Z][^·.|]{2,60},\s*[A-Z][^·.|]{2,40})\s*[·.|]/);
  const location = locMatch && !JOB_WORDS.test(locMatch[1]) ? locMatch[1].trim() : undefined;
  const locField = text.match(/(?:Location|Area):\s*([^·|]+?)\s*(?:·|\||$)/i)?.[1]?.trim();

  const found = toCandidate({
    profileUrl,
    fullName: bits[0],
    headline,
    currentTitle,
    currentCompany,
    location: location ?? locField ?? inferLocation(`${clean} ${text}`.split(bits[0]).join(" "), opts.location),
    summary: text || undefined,
    snippet: text,
    capturedBy: "xray-search",
    capturedAt: new Date().toISOString(),
  });
  if (!found) return null;
  // Only what the title/snippet happens to mention, so a missing skill proves nothing.
  return { ...found, skills: detectSkills(`${clean} ${text}`), skillsComplete: false };
}

/** Canonical profile URL for a non-LinkedIn portal result, or null when the link is not a person's profile. */
export function portalProfileUrl(portal: XrayPortalId, link: string): string | null {
  const u = (() => {
    try {
      return new URL(link);
    } catch {
      return null;
    }
  })();
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  if (portal === "bayt") {
    return host === "people.bayt.com" && /^\/profile-[^/]+$/i.test(path) ? `https://people.bayt.com${path}/` : null;
  }
  if (portal === "xing") {
    return host.endsWith("xing.com") && /^\/profile\/[^/]+$/i.test(path) ? `https://www.xing.com${path}` : null;
  }
  if (portal === "stackoverflow") {
    const m = /^\/users\/(\d+)(?:\/([^/]+))?$/.exec(path);
    return host === "stackoverflow.com" && m ? `https://stackoverflow.com/users/${m[1]}${m[2] ? `/${m[2]}` : ""}` : null;
  }
  if (portal === "behance") {
    const reserved = new Set(["gallery", "search", "joblist", "hire", "galleries", "live", "assets", "about", "features"]);
    const m = /^\/([^/]+)$/.exec(path);
    return host === "behance.net" && m && !reserved.has(m[1].toLowerCase()) ? `https://www.behance.net${path}` : null;
  }
  return null;
}

/** Maps one Xing/Bayt/Stack Overflow/Behance search result to a Candidate (name and headline only). */
export function portalResultToCandidate(
  portal: XrayPortalId,
  link: string,
  title: string,
  snippet: string,
  opts: { location?: string } = {},
): Candidate | null {
  const profileUrl = portalProfileUrl(portal, link);
  if (!profileUrl) return null;

  const text = snippet.replace(BIDI, "").replace(/\s+/g, " ").trim();
  const clean = title
    .replace(BIDI, "")
    .replace(/^User\s+/i, "")
    .replace(/\s*[|\-–]\s*(?:XING|Behance|Bayt(?:\.com)?|Stack Overflow)[^|]*$/i, "")
    .trim();
  const bits = clean.split(/\s+[-–|]\s+/).map((b) => b.trim()).filter(Boolean);
  const fullName = bits[0];
  if (!fullName) return null;

  const headline = bits.slice(1).join(" | ") || undefined;
  const first = bits[1] ?? "";
  const at = first.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  const currentTitle = ((at ? at[1] : first).replace(/\s+in\s+[A-Z][^,]*,?.*$/, "").trim() || undefined) as string | undefined;
  // Xing prints "Name - Title - Company"; elsewhere the company is only trusted from "X at Company".
  const currentCompany = cleanCompany(at?.[2]) ?? (portal === "xing" ? cleanCompany(bits[2]) : undefined);
  const location = inferLocation(`${clean} ${text}`.split(fullName).join(" "), opts.location);

  return {
    externalId: profileUrl,
    fullName,
    headline,
    currentTitle,
    currentCompany,
    location,
    profileUrl,
    summary: text || undefined,
    skills: detectSkills(`${clean} ${text}`),
    skillsComplete: false,
    experience: [],
    education: [],
    languages: [],
    certifications: [],
    raw: { portal, snippet: text },
  };
}

interface ResultItem {
  link?: string;
  title?: string;
  snippet?: string;
}

async function failIfNotOk(res: Response, provider: XrayProvider): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  const reason =
    res.status === 429
      ? "free quota used up"
      : res.status === 401 || res.status === 403
        ? `key rejected (HTTP ${res.status}) ${body.slice(0, 160)}`
        : `HTTP ${res.status} ${body.slice(0, 200)}`;
  throw new Error(`${provider} search failed: ${reason}`);
}

/** Fetches one page (10 results) of search results from the chosen provider. */
async function fetchPage(provider: XrayProvider, query: string, page: number): Promise<ResultItem[]> {
  if (provider === "serper") {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY as string, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: PAGE_SIZE, page: page + 1 }),
    });
    await failIfNotOk(res, provider);
    return ((await res.json()) as { organic?: ResultItem[] }).organic ?? [];
  }
  if (provider === "serpapi") {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      num: String(PAGE_SIZE),
      start: String(page * PAGE_SIZE),
      api_key: process.env.SERPAPI_KEY as string,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    await failIfNotOk(res, provider);
    return ((await res.json()) as { organic_results?: ResultItem[] }).organic_results ?? [];
  }
  const params = new URLSearchParams({
    key: process.env.GOOGLE_API_KEY as string,
    cx: process.env.GOOGLE_CSE_ID as string,
    q: query,
    start: String(page * PAGE_SIZE + 1),
  });
  const res = await fetch(`${CSE_URL}?${params}`);
  await failIfNotOk(res, provider);
  return ((await res.json()) as { items?: ResultItem[] }).items ?? [];
}

async function searchXray(filters: Partial<SearchFilters>, _options?: SourceSearchOptions): Promise<Candidate[]> {
  void _options;
  const provider = pickProvider();
  if (!provider) throw new Error(MISSING_KEYS_MESSAGE);

  const wanted = Math.min(filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_LIMIT, MAX_LIMIT);
  // One query per title variant, taken in turns page by page so every variant
  // contributes before any single one runs the budget down.
  const portals = selectedPortals(filters.portals);
  // Several portals multiply the queries, so fewer title variants are used to keep credits down.
  const titles = [...new Set((filters.titles ?? []).map((t) => t.trim()).filter(Boolean))].slice(
    0,
    portals.length > 1 ? 2 : MAX_TITLE_VARIANTS,
  );
  const jobs: { portal: XrayPortalId; query: string }[] = portals.flatMap((portal) => {
    const site = XRAY_PORTALS.find((p) => p.id === portal)!.site;
    return titles.length > 0
      ? titles.map((t) => ({ portal, query: buildXrayQuery({ ...filters, titles: [t] }, site) }))
      : [{ portal, query: buildXrayQuery(filters, site) }];
  });
  const queries = jobs.map((j) => j.query);
  const exhausted = new Set<number>();
  const wantedLocation = filters.location?.[0];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (let page = 0; candidates.length < wanted && page < MAX_PAGES && exhausted.size < queries.length; page++) {
    for (let q = 0; q < queries.length && candidates.length < wanted; q++) {
      if (exhausted.has(q)) continue;
      const items = await fetchPage(provider, queries[q], page);
      if (items.length === 0) {
        exhausted.add(q);
        continue;
      }
      for (const item of items) {
        const { portal } = jobs[q];
        const args = [item.link ?? "", item.title ?? "", item.snippet ?? ""] as const;
        const c =
          portal === "linkedin"
            ? resultToCandidate(...args, { location: wantedLocation })
            : portalResultToCandidate(portal, ...args, { location: wantedLocation });
        if (c && !seen.has(c.profileUrl)) {
          seen.add(c.profileUrl);
          candidates.push(c);
        }
      }
    }
  }
  return candidates.slice(0, wanted);
}

export const linkedinXraySource: CandidateSource = {
  id: "linkedin-xray",
  label: "Portals (Google)",
  unsupportedFields: [
    "skills",
    "experience",
    "education",
    "languages",
    "certifications",
    "totalYearsExperience",
    "industry",
  ],
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
  description: {
    searches:
      "Finds public candidate profiles on the portals you tick (LinkedIn, Bayt, Xing, Stack Overflow, Behance) by " +
      "searching Google (through a search API) for your job title, location and must-have skills. It reads what the " +
      "search result shows; it never opens or logs in to any portal. Indeed and Glassdoor are not available.",
    reliablyReturns: [
      "Name",
      "Headline (usually title and company)",
      "LinkedIn profile URL",
      "Location (when shown, or the searched place when the result mentions it)",
      "Skills only when the title or snippet happens to mention them",
    ],
    cannotProvide: [
      "Skills, work history, years of experience or education — open the profile and use the Import page's bookmarklet to capture those",
      "Contact details",
      "Anyone whose profile is private or not indexed by Google",
    ],
    cost: "Free to start — Serper gives 2,500 free searches (one-time); SerpApi has a small free monthly plan.",
    setupAndLimits:
      "One-time setup: a free key from serper.dev (SERPER_API_KEY) or serpapi.com (SERPAPI_KEY) in .env. " +
      "Each search uses one free search per page of 10 results (up to 5 pages per job title, up to 3 title variants) and returns up to 50 results.",
    readyNow: true,
    notes: [
      "If the keys are missing the search stops with a message saying so.",
      "Treat results as leads: with no skills data, ranking is mostly title and location match.",
    ],
  },
  search: searchXray,
};
