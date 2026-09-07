import { SearchFilters, buildBooleanQuery } from "./buildBooleanQuery";
import mockCandidates from "@/data/mockCandidates.json";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID;
const APIFY_MOCK = process.env.APIFY_MOCK === "true";
const APIFY_ACTOR_INPUT_VERIFIED = process.env.APIFY_ACTOR_INPUT_VERIFIED === "true";

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

export async function startRun(filters: Partial<SearchFilters>) {
  if (APIFY_MOCK) {
    return { runId: "mock-run-id", datasetId: "mock-dataset-id" };
  }

  const { token, actorId } = requireCredentials("tokenAndActor");

  if (!APIFY_ACTOR_INPUT_VERIFIED) {
    throw new Error(ACTOR_INPUT_UNVERIFIED_MESSAGE);
  }

  const input = buildActorInput(filters);

  const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to start Apify run: HTTP ${res.status} ${res.statusText} - ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
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

export async function fetchDatasetItems(datasetId: string, limit: number = 50): Promise<Candidate[]> {
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

  return rawItems.map(mapToCandidate);
}

function buildActorInput(filters: Partial<SearchFilters>) {
  const query = buildBooleanQuery(filters);
  // PROVISIONAL / UNVERIFIED — see ACTOR_INPUT_UNVERIFIED_MESSAGE above.
  // Example mapping for a generic LinkedIn scraper actor; the real actor's
  // field names have not been chosen or confirmed. Do not adjust these
  // field names on a guess — run `npm run apify:probe` against the chosen
  // actor and update this function to match its real input schema.
  return {
    queries: [query],
    maxProfilesPerQuery: filters.limit || 50,
  };
}

// `rawItem.<field>` comes straight off an external scraper with no schema guarantee: any of
// these array-shaped fields may be missing, null, or a truthy non-array (a number, a string,
// or a plain object) rather than an array. `(x || []).map(...)` survives null/undefined but
// throws on a truthy non-array, so every array-shaped field is guarded with Array.isArray
// instead. Individual array elements are just as untrustworthy (e.g. `[null]`), so every
// property read off an element below uses optional chaining rather than assuming the element
// itself is a well-formed object.
function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function mapToCandidate(rawItem: any): Candidate {
  return {
    externalId: rawItem.id || rawItem.profileUrl,
    fullName: rawItem.fullName || [rawItem.firstName, rawItem.lastName].filter(Boolean).join(" "),
    headline: rawItem.headline,
    currentTitle: rawItem.currentJobTitle || rawItem.currentTitle,
    currentCompany: rawItem.currentCompany,
    location: rawItem.location,
    profileUrl: rawItem.profileUrl || rawItem.url,
    avatarUrl: rawItem.avatarUrl || rawItem.profilePicture,
    summary: rawItem.summary || rawItem.about,
    industry: rawItem.industry,
    skills: asArray(rawItem.skills)
      .map((s: any) => (typeof s === "string" ? s : s?.name))
      .filter((s: unknown): s is string => typeof s === "string"),
    experience: asArray(rawItem.experience).map((exp: any) => ({
      title: exp?.title,
      company: exp?.company,
      durationMonths: exp?.durationMonths,
      from: exp?.startDate || exp?.from,
      to: exp?.endDate || exp?.to,
    })),
    education: asArray(rawItem.education).map((ed: any) => ({
      school: ed?.school,
      degree: ed?.degreeName || ed?.degree,
      field: ed?.fieldOfStudy || ed?.field,
      year: ed?.year,
    })),
    languages: asArray(rawItem.languages),
    certifications: asArray(rawItem.certifications)
      .map((c: any) => (typeof c === "string" ? c : c?.name))
      .filter((c: unknown): c is string => typeof c === "string"),
    totalYearsExperience: rawItem.totalYearsExperience,
    raw: rawItem,
  };
}
