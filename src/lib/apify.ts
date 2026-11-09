import { SearchFilters, buildBooleanQuery } from "./buildBooleanQuery";
import mockCandidates from "@/data/mockCandidates.json";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID;
// Mock data must never be served from a production build, even if APIFY_MOCK
// is left on in .env by mistake.
const APIFY_MOCK = process.env.APIFY_MOCK === "true" && process.env.NODE_ENV !== "production";
const APIFY_ACTOR_INPUT_VERIFIED = process.env.APIFY_ACTOR_INPUT_VERIFIED === "true";

/** True when the Apify source can run: mock mode (dev only) or fully configured live. */
export const APIFY_AVAILABLE =
  APIFY_MOCK || (!!APIFY_TOKEN && !!APIFY_ACTOR_ID && APIFY_ACTOR_INPUT_VERIFIED);

/** Apify caps items-per-request on the dataset endpoint; page in chunks this size. */
export const APIFY_DATASET_PAGE_SIZE = 100;

export type RawLanguage =
  | string
  | { name?: string; language?: string; proficiency?: string; level?: string };

export type Candidate = {
  externalId: string;
  fullName: string;
  headline?: string;
  currentTitle?: string;
  currentCompany?: string;
  location?: string;
  profileUrl: string;
  avatarUrl?: string;
  summary?: string;
  industry?: string;
  skills: string[];
  experience: { title: string; company: string; from?: string; to?: string; durationMonths?: number }[];
  education: { school: string; degree?: string; field?: string; year?: string }[];
  languages?: RawLanguage[];
  certifications?: string[];
  totalYearsExperience?: number;
  /** False when `skills` is only a partial list, so a missing skill proves nothing. */
  skillsComplete?: boolean;
  raw: unknown;
};

/**
 * Builds the "Missing Apify credential(s): ..." message used by startRun,
 * getRunStatus and fetchDatasetItems, so the failure names exactly which
 * env var is absent instead of a bare "Missing Apify credentials". Pure so
 * it can be unit-tested without touching process.env or the network.
 */
export function missingCredentialsMessage(missing: string[]): string {
  const list = missing.join(", ");
  const plural = missing.length > 1;
  return (
    `Missing Apify credential${plural ? "s" : ""}: ${list}. ` +
    `Set ${plural ? "them" : "it"} in .env (see README.md), or set APIFY_MOCK=true to keep using mock data.`
  );
}

/**
 * buildActorInput() below is a guessed, provisional mapping for a generic
 * LinkedIn scraper actor — the user has not chosen a real actor yet, and
 * different actors take incompatible input shapes. Sending it to a real,
 * paid Apify run before it has been checked against that actor's actual
 * input schema risks an empty/garbage result that still gets billed. This
 * message is what stops that: it fires whenever APIFY_MOCK is false unless
 * the operator has explicitly set APIFY_ACTOR_INPUT_VERIFIED=true after
 * checking buildActorInput() against `npm run apify:probe` output.
 */
export const ACTOR_INPUT_UNVERIFIED_MESSAGE =
  "Apify actor input mapping is unverified. buildActorInput() in src/lib/apify.ts is a placeholder " +
  "shaped for a generic LinkedIn scraper actor, not the actor you've configured — it has not been " +
  "checked against that actor's real input schema. Run `npm run apify:probe` to inspect the chosen " +
  "actor's input schema and dataset shape, update buildActorInput()/mapToCandidate() to match, then " +
  "set APIFY_ACTOR_INPUT_VERIFIED=true in .env to allow a live (billed) run.";

function requireCredentials(need: "token" | "tokenAndActor"): { token: string; actorId?: string } {
  const missing: string[] = [];
  if (!APIFY_TOKEN) missing.push("APIFY_TOKEN");
  if (need === "tokenAndActor" && !APIFY_ACTOR_ID) missing.push("APIFY_ACTOR_ID");
  if (missing.length > 0) {
    throw new Error(missingCredentialsMessage(missing));
  }
  return { token: APIFY_TOKEN as string, actorId: APIFY_ACTOR_ID };
}

/** Actors to try, in order: APIFY_ACTOR_ID may be a comma-separated list. */
export function configuredActorIds(raw: string | undefined = APIFY_ACTOR_ID): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim().replace("~", "/"))
    .filter(Boolean);
}

type ActorAdapter = {
  buildInput: (filters: Partial<SearchFilters>) => Record<string, unknown>;
  mapItem: (raw: any) => Candidate;
};

// Per-actor input builder and output mapper, each checked against that
// actor's real schema and a real run (see `npm run apify:probe`).
const ACTOR_ADAPTERS: Record<string, ActorAdapter> = {
  "harvestapi/linkedin-profile-search": { buildInput: buildActorInput, mapItem: mapToCandidate },
  "memo23/linkedin-people-search": { buildInput: buildMemo23Input, mapItem: mapMemo23ToCandidate },
};

function adapterFor(actorId: string): ActorAdapter {
  const adapter = ACTOR_ADAPTERS[actorId.toLowerCase()];
  if (!adapter) {
    throw new Error(
      `No input/output mapping exists for Apify actor "${actorId}". Supported: ${Object.keys(ACTOR_ADAPTERS).join(", ")}.`,
    );
  }
  return adapter;
}

/**
 * Starts the search on the actor at `actorIndex` in APIFY_ACTOR_ID. Returns
 * `hasNext` so the caller can fall back to the following actor when this one
 * refuses to run (e.g. a free-plan run cap).
 */
export async function startRun(filters: Partial<SearchFilters>, actorIndex = 0) {
  if (APIFY_MOCK) {
    return { runId: "mock-run-id", datasetId: "mock-dataset-id", actorIndex: 0, hasNext: false };
  }

  const { token } = requireCredentials("tokenAndActor");

  if (!APIFY_ACTOR_INPUT_VERIFIED) {
    throw new Error(ACTOR_INPUT_UNVERIFIED_MESSAGE);
  }

  const actorIds = configuredActorIds();
  const actorId = actorIds[actorIndex];
  const input = adapterFor(actorId).buildInput(filters);

  const res = await fetch(`https://api.apify.com/v2/acts/${apiActorId(actorId)}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to start Apify run: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return {
    runId: data.data.id,
    datasetId: data.data.defaultDatasetId,
    actorIndex,
    hasNext: actorIndex + 1 < actorIds.length,
  };
}

/**
 * Like getRunStatus, plus Apify's human-readable status message. An actor can
 * finish "SUCCEEDED" with zero items while the message says why (e.g. the
 * actor author's "free user run limit reached"), so callers use it to explain
 * an empty result instead of showing a bare "Done".
 */
const actorHashCache = new Map<string, string>();

/** Which entry of APIFY_ACTOR_ID produced a run (Apify reports only the actor's internal id). */
async function actorIndexForRun(actId: string | undefined, token: string): Promise<number> {
  const ids = configuredActorIds();
  if (!actId) return 0;
  for (let i = 0; i < ids.length; i++) {
    let hash = actorHashCache.get(ids[i]);
    if (!hash) {
      const res = await fetch(`https://api.apify.com/v2/acts/${apiActorId(ids[i])}?token=${token}`);
      if (!res.ok) continue;
      hash = (await res.json()).data.id as string;
      actorHashCache.set(ids[i], hash);
    }
    if (hash === actId) return i;
  }
  return 0;
}

export async function getRunDetails(
  runId: string,
): Promise<{ status: string; statusMessage?: string; actorIndex: number; hasNext: boolean }> {
  if (APIFY_MOCK) return { status: "SUCCEEDED", actorIndex: 0, hasNext: false };
  const { token } = requireCredentials("token");

  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to get Apify run status: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const actorIndex = await actorIndexForRun(data.data.actId, token);
  return {
    status: data.data.status,
    statusMessage: data.data.statusMessage,
    actorIndex,
    hasNext: actorIndex + 1 < configuredActorIds().length,
  };
}

export async function getRunStatus(runId: string) {
  if (APIFY_MOCK) return "SUCCEEDED";
  const { token } = requireCredentials("token");

  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to get Apify run status: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.data.status;
}

/**
 * Pages through fetchPage(offset, limit) until `limit` items have been
 * collected or the source is exhausted, whichever comes first. Extracted
 * from fetchDatasetItems so the paging decisions (page size, stopping
 * condition, runaway-loop guard) are testable with a fake fetchPage and no
 * network. `limit` is the ceiling — never fetches more than that.
 */
export async function paginateItems<T>(
  fetchPage: (offset: number, take: number) => Promise<T[]>,
  limit: number,
  pageSize: number = APIFY_DATASET_PAGE_SIZE,
): Promise<T[]> {
  const items: T[] = [];
  const safePageSize = Math.max(1, pageSize);
  const safeLimit = Math.max(0, limit);
  // Safety net against a misbehaving API that keeps returning items forever:
  // cap the number of requests to what satisfying `limit` should take, plus
  // a small margin, rather than looping until items.length reaches limit.
  const maxPages = Math.ceil(safeLimit / safePageSize) + 5;

  for (let page = 0; page < maxPages && items.length < safeLimit; page++) {
    const want = Math.min(safePageSize, safeLimit - items.length);
    const batch = await fetchPage(items.length, want);
    if (!batch || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < want) break; // fewer than requested means the dataset is exhausted
  }

  return items.slice(0, safeLimit);
}

export async function fetchDatasetItems(
  datasetId: string,
  limit: number = 50,
  actorIndex: number = 0,
): Promise<Candidate[]> {
  if (APIFY_MOCK) {
    return mockCandidates as Candidate[];
  }
  const { token } = requireCredentials("token");

  const rawItems = await paginateItems<unknown>(async (offset, take) => {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&offset=${offset}&limit=${take}`,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to fetch dataset items: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
    }
    return res.json();
  }, limit);

  const actorId = configuredActorIds()[actorIndex];
  const mapItem = actorId ? adapterFor(actorId).mapItem : mapToCandidate;
  return rawItems.map(mapItem);
}

/** The REST API wants `username~actor-name`; the Store shows `username/actor-name`. */
export function apiActorId(id: string | undefined): string {
  return (id ?? "").replace("/", "~");
}

/** Hard ceiling on profiles per run: Full mode is billed per profile. */
export const APIFY_MAX_ITEMS = 100;

/**
 * Maps dashboard filters onto harvestapi/linkedin-profile-search (checked
 * against `npm run apify:probe` output). Title, location, seniority, years of
 * experience, must-have skills and excluded titles are sent to the actor so it
 * finds better matches up front; everything is still re-scored locally.
 *
 * Every actor-side filter shrinks the pool, so each one is only sent when it
 * can be expressed exactly: a seniority selection containing a level LinkedIn
 * has no equivalent for (e.g. "Mid") is not sent at all, rather than silently
 * excluding those people.
 */
// Dashboard seniority label -> LinkedIn seniority IDs used by the actor.
const SENIORITY_IDS: Record<string, string[]> = {
  Intern: ["100"],
  Junior: ["110"],
  Senior: ["120"],
  Staff: ["120"],
  Manager: ["200", "210"],
  Head: ["220"],
  Director: ["220"],
};

// LinkedIn years-of-experience buckets: id -> [from, to) in years.
const YEARS_BUCKETS: [string, number, number][] = [
  ["1", 0, 1],
  ["2", 1, 3],
  ["3", 3, 6],
  ["4", 6, 11],
  ["5", 11, Infinity],
];

export function seniorityIds(levels: string[] | undefined): string[] | undefined {
  const picked = (levels || []).map((l) => l.trim()).filter(Boolean);
  if (picked.length === 0 || picked.some((l) => !SENIORITY_IDS[l])) return undefined;
  return [...new Set(picked.flatMap((l) => SENIORITY_IDS[l]))];
}

export function yearsOfExperienceIds(min: number | undefined, max: number | undefined): string[] | undefined {
  const lo = min ?? 0;
  const hi = max ?? 20;
  if (lo <= 0 && hi >= 20) return undefined; // the UI default: no restriction
  const ids = YEARS_BUCKETS.filter(([, from, to]) => to > lo && from <= hi).map(([id]) => id);
  return ids.length > 0 ? ids : undefined;
}
export function buildActorInput(filters: Partial<SearchFilters>) {
  const titles = (filters.titles || []).map((t) => t.trim()).filter(Boolean);
  const locations = (filters.location || []).map((l) => l.trim()).filter(Boolean);
  const input: Record<string, unknown> = {
    profileScraperMode: "Full",
    maxItems: Math.min(Math.max(filters.limit || 25, 1), APIFY_MAX_ITEMS),
  };
  const quote = (t: string) => (/\s/.test(t) ? `"${t}"` : t);
  const skills = [...new Set((filters.mustHave || []).map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  const queryParts: string[] = [];
  if (titles.length > 0) queryParts.push(titles.length > 1 ? `(${titles.map(quote).join(" OR ")})` : quote(titles[0]));
  for (const s of skills) queryParts.push(quote(s));
  if (queryParts.length > 0) input.searchQuery = queryParts.join(" AND ");
  if (locations.length > 0) input.locations = locations;

  const seniority = seniorityIds(filters.seniority);
  if (seniority) input.seniorityLevelIds = seniority;
  const years = yearsOfExperienceIds(filters.yearsMin, filters.yearsMax);
  if (years) input.yearsOfExperienceIds = years;
  const excluded = [...new Set((filters.exclude || []).map((e) => e.trim()).filter(Boolean))];
  if (excluded.length > 0) input.excludeCurrentJobTitles = excluded;
  return input;
}

// `rawItem.<field>` comes straight off an external scraper with no schema guarantee: any of
// these array-shaped fields may be missing, null, or a truthy non-array (a number, a string,
// or a plain object) rather than an array. `(x || []).map(...)` survives null/undefined but
// throws on a truthy non-array, so every array-shaped field is guarded with Array.isArray
// instead. Individual array elements are just as untrustworthy (e.g. `[null]`), so every
// property read off an element below uses optional chaining rather than assuming the element
// itself is a well-formed object.
/** "2 yrs 3 mos" -> 27; undefined when it can't be read. */
export function parseDurationMonths(text: unknown): number | undefined {
  if (typeof text !== "string") return undefined;
  const y = /(\d+)\s*yr/.exec(text);
  const m = /(\d+)\s*mo/.exec(text);
  if (!y && !m) return undefined;
  return (y ? Number(y[1]) * 12 : 0) + (m ? Number(m[1]) : 0);
}

function dateText(d: any): string | undefined {
  if (typeof d === "string") return d;
  return typeof d?.text === "string" ? d.text : undefined;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function mapToCandidate(rawItem: any): Candidate {
  return {
    externalId: rawItem.id || rawItem.publicIdentifier || rawItem.profileUrl || rawItem.linkedinUrl,
    fullName: rawItem.fullName || [rawItem.firstName, rawItem.lastName].filter(Boolean).join(" "),
    headline: rawItem.headline,
    currentTitle: rawItem.currentJobTitle || rawItem.currentTitle || asArray(rawItem.currentPosition)[0]?.position,
    currentCompany: rawItem.currentCompany || asArray(rawItem.currentPosition)[0]?.companyName,
    location:
      typeof rawItem.location === "string"
        ? rawItem.location
        : rawItem.location?.parsed?.text || rawItem.location?.linkedinText,
    profileUrl: rawItem.profileUrl || rawItem.linkedinUrl || rawItem.url,
    avatarUrl:
      rawItem.avatarUrl ||
      rawItem.photo ||
      (typeof rawItem.profilePicture === "string" ? rawItem.profilePicture : rawItem.profilePicture?.url),
    summary: rawItem.summary || rawItem.about,
    industry: typeof rawItem.industry === "string" ? rawItem.industry : rawItem.industry?.name,
    skills: [
      ...new Set(
        [...asArray(rawItem.skills), ...asArray(rawItem.topSkills)]
          .map((s: any) => (typeof s === "string" ? s : s?.name))
          .filter((s: unknown): s is string => typeof s === "string"),
      ),
    ],
    experience: asArray(rawItem.experience).map((exp: any) => ({
      title: exp?.title || exp?.position,
      company: exp?.company || exp?.companyName,
      durationMonths: exp?.durationMonths ?? parseDurationMonths(exp?.duration),
      from: dateText(exp?.startDate) || exp?.from,
      to: dateText(exp?.endDate) || exp?.to,
    })),
    education: asArray(rawItem.education).map((ed: any) => ({
      school: ed?.school || ed?.schoolName,
      degree: ed?.degreeName || ed?.degree,
      field: ed?.fieldOfStudy || ed?.field,
      year: ed?.year || (ed?.endDate?.year != null ? String(ed.endDate.year) : undefined),
    })),
    languages: asArray(rawItem.languages),
    certifications: asArray(rawItem.certifications)
      .map((c: any) => (typeof c === "string" ? c : c?.name || c?.title))
      .filter((c: unknown): c is string => typeof c === "string"),
    totalYearsExperience: rawItem.totalYearsExperience,
    raw: rawItem,
  };
}

// ---------------------------------------------------------------------------
// memo23/linkedin-people-search (public, cookie-free mode)
// ---------------------------------------------------------------------------

// Dashboard seniority label -> the actor's seniorityLevels enum.
const MEMO23_SENIORITY: Record<string, string> = {
  Intern: "Intern",
  Junior: "Entry",
  Senior: "Senior",
  Staff: "Senior",
  Manager: "Manager",
  Head: "Director",
  Director: "Director",
};

export function buildMemo23Input(filters: Partial<SearchFilters>) {
  const titles = (filters.titles || []).map((t) => t.trim()).filter(Boolean);
  const locations = (filters.location || []).map((l) => l.trim()).filter(Boolean);
  const input: Record<string, unknown> = {
    mode: "public",
    maxResults: Math.min(Math.max(filters.limit || 25, 1), APIFY_MAX_ITEMS),
  };
  if (titles.length > 0) {
    // The location is repeated in the keywords because this actor's location
    // filter alone is loose ("City, Country" worked; a bare city did not).
    input.keywords = locations.length > 0 ? `${titles[0]} ${locations[0]}` : titles[0];
    input.title = titles[0];
    // Each extra title is its own search, so it needs the location as well.
    if (titles.length > 1) {
      input.queries = titles.slice(1).map((t) => (locations.length > 0 ? `${t} ${locations[0]}` : t));
    }
  }
  if (locations.length > 0) input.location = locations[0];

  // Same all-or-nothing rule as the HarvestAPI mapping: skip the filter if any
  // chosen level has no equivalent, rather than silently excluding people.
  const picked = (filters.seniority || []).map((l) => l.trim()).filter(Boolean);
  if (picked.length > 0 && picked.every((l) => MEMO23_SENIORITY[l])) {
    input.seniorityLevels = [...new Set(picked.map((l) => MEMO23_SENIORITY[l]))];
  }
  return input;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Apr 2026 - Present" / "2019 - 2024" -> { from, to, months }. */
export function parseDateRange(text: unknown): { from?: string; to?: string; months?: number } {
  if (typeof text !== "string") return {};
  const [a, b] = text.split(/\s[-–]\s/).map((s) => s.trim());
  if (!a) return {};
  const toIndex = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    if (/present/i.test(s)) return new Date().getFullYear() * 12 + new Date().getMonth();
    const year = /(\d{4})/.exec(s);
    if (!year) return undefined;
    const month = MONTHS.indexOf(s.slice(0, 3).toLowerCase());
    return Number(year[1]) * 12 + (month >= 0 ? month : 0);
  };
  const start = toIndex(a);
  const end = toIndex(b);
  return {
    from: a,
    to: b,
    months: start !== undefined && end !== undefined && end >= start ? end - start : undefined,
  };
}

export function mapMemo23ToCandidate(raw: any): Candidate {
  const experience = asArray(raw?.experience).map((exp: any) => {
    const range = parseDateRange(exp?.date);
    return {
      title: exp?.title,
      company: exp?.company,
      from: range.from,
      to: range.to,
      durationMonths: range.months,
    };
  });
  const totalMonths = experience.reduce((sum, e) => sum + (e.durationMonths ?? 0), 0);

  return {
    externalId: raw?.profileUrl || raw?.urnId,
    fullName: raw?.name || "",
    headline: raw?.summary,
    currentTitle: raw?.jobTitle,
    currentCompany: raw?.currentCompany,
    location: raw?.location,
    profileUrl: raw?.profileUrl,
    avatarUrl: raw?.imageUrl,
    summary: raw?.about,
    skills: asArray(raw?.topSkills).filter((s: unknown): s is string => typeof s === "string"),
    skillsComplete: false, // the public page exposes only a few "top skills"
    experience,
    education: asArray(raw?.education).map((ed: any) => ({
      school: ed?.school,
      degree: ed?.degree,
      year: typeof ed?.date === "string" ? /(\d{4})\s*$/.exec(ed.date)?.[1] : undefined,
    })),
    languages: asArray(raw?.languages),
    certifications: [],
    totalYearsExperience: totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : undefined,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Deep scan: full profile details for a few already-found LinkedIn URLs
// ---------------------------------------------------------------------------

/** Billed per profile (about $4 per 1,000), so the batch is kept small. */
export const DEEP_SCAN_MAX = 10;
export const DEEP_SCAN_ACTOR_ID = process.env.APIFY_PROFILE_ACTOR_ID || "harvestapi/linkedin-profile-scraper";

export async function startDeepScan(urls: string[]) {
  if (APIFY_MOCK) throw new Error("Deep scan is not available in mock mode.");
  const { token } = requireCredentials("token");
  const batch = urls.slice(0, DEEP_SCAN_MAX);
  if (batch.length === 0) throw new Error("No LinkedIn profiles to scan.");

  const res = await fetch(`https://api.apify.com/v2/acts/${apiActorId(DEEP_SCAN_ACTOR_ID)}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileScraperMode: "Profile details no email ($4 per 1k)", urls: batch }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to start Apify deep scan: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return { runId: data.data.id as string, datasetId: data.data.defaultDatasetId as string, count: batch.length };
}

/** Status of a deep-scan run (its actor is not one of the search actors in APIFY_ACTOR_ID). */
export async function getDeepScanRun(runId: string): Promise<{ status: string; statusMessage?: string }> {
  const { token } = requireCredentials("token");
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to get Apify run status: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return { status: data.data.status, statusMessage: data.data.statusMessage };
}

/**
 * Fetches the scanned profiles and maps them. Each result is re-keyed to the
 * profile URL we asked for (matched on its public identifier) so the fuller
 * data lands on the same Person row the X-ray search created.
 */
export async function fetchDeepScanItems(
  datasetId: string,
  requestedUrls: string[],
  canonicalize: (url: string) => string | null,
): Promise<Candidate[]> {
  const { token } = requireCredentials("token");
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${DEEP_SCAN_MAX}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch dataset items: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const items: any[] = await res.json();

  const bySlug = new Map<string, string>();
  for (const url of requestedUrls) {
    const canon = canonicalize(url);
    if (canon) bySlug.set(canon.split("/in/")[1], canon);
  }

  const out: Candidate[] = [];
  for (const item of items) {
    const slug = String(item?.publicIdentifier ?? canonicalize(String(item?.linkedinUrl ?? ""))?.split("/in/")[1] ?? "").toLowerCase();
    const url = bySlug.get(slug);
    if (!url) continue;
    out.push({ ...mapToCandidate(item), profileUrl: url });
  }
  return out;
}
