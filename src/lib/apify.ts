import { SearchFilters, buildBooleanQuery } from "./buildBooleanQuery";
import mockCandidates from "@/data/mockCandidates.json";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID;
const APIFY_MOCK = process.env.APIFY_MOCK === "true";

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
  skills: string[];
  experience: { title: string; company: string; from?: string; to?: string; durationMonths?: number }[];
  education: { school: string; degree?: string; field?: string; year?: string }[];
  languages?: string[];
  certifications?: string[];
  totalYearsExperience?: number;
  raw: unknown;
};

export async function startRun(filters: Partial<SearchFilters>) {
  if (APIFY_MOCK) {
    return { runId: "mock-run-id", datasetId: "mock-dataset-id" };
  }

  if (!APIFY_TOKEN || !APIFY_ACTOR_ID) {
    throw new Error("Missing Apify credentials");
  }

  const input = buildActorInput(filters);

  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to start Apify run");
  const data = await res.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

export async function getRunStatus(runId: string) {
  if (APIFY_MOCK) return "SUCCEEDED";
  if (!APIFY_TOKEN) throw new Error("Missing Apify credentials");

  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  if (!res.ok) throw new Error("Failed to get run status");
  const data = await res.json();
  return data.data.status;
}

export async function fetchDatasetItems(datasetId: string, offset = 0, limit = 50): Promise<Candidate[]> {
  if (APIFY_MOCK) {
    return mockCandidates as Candidate[];
  }
  if (!APIFY_TOKEN) throw new Error("Missing Apify credentials");

  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch dataset items");
  const data = await res.json();
  return data.map(mapToCandidate);
}

function buildActorInput(filters: Partial<SearchFilters>) {
  const query = buildBooleanQuery(filters);
  // Example mapping for a generic LinkedIn scraper actor
  return {
    queries: [query],
    maxProfilesPerQuery: filters.limit || 50,
  };
}

function mapToCandidate(rawItem: any): Candidate {
  return {
    externalId: rawItem.id || rawItem.profileUrl,
    fullName: rawItem.fullName || [rawItem.firstName, rawItem.lastName].filter(Boolean).join(" "),
    headline: rawItem.headline,
    currentTitle: rawItem.currentJobTitle,
    currentCompany: rawItem.currentCompany,
    location: rawItem.location,
    profileUrl: rawItem.profileUrl || rawItem.url,
    avatarUrl: rawItem.avatarUrl || rawItem.profilePicture,
    summary: rawItem.summary || rawItem.about,
    skills: rawItem.skills?.map((s: any) => typeof s === "string" ? s : s.name) || [],
    experience: (rawItem.experience || []).map((exp: any) => ({
      title: exp.title,
      company: exp.company,
      durationMonths: exp.durationMonths,
      from: exp.startDate,
      to: exp.endDate,
    })),
    education: (rawItem.education || []).map((ed: any) => ({
      school: ed.school,
      degree: ed.degreeName,
    })),
    languages: rawItem.languages?.map((l: any) => typeof l === "string" ? l : l.name) || [],
    totalYearsExperience: rawItem.totalYearsExperience,
    raw: rawItem,
  };
}
