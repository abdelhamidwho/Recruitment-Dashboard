"use client";

import type { CollaborationState } from "@/lib/collaboration";

export type { CollaborationState };

/** Thin fetch wrappers for the collaboration API. Every call surfaces failure via the return value — callers must check `.ok` and show it, per the "handle a failed action visibly" rule. */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function call<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error || `Request failed (${res.status})` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const jsonHeaders = { "Content-Type": "application/json" };

/** Batch collaboration state for a set of people — one call for the whole visible list, never per-candidate. */
export function fetchCollaborationState(personIds: string[]) {
  return call<{ state: Record<string, CollaborationState> }>("/api/people/collaboration", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ personIds }),
  });
}

export function recordProfileView(personId: string) {
  return call<{ view: unknown }>(`/api/people/${personId}/view`, { method: "POST" });
}

export interface ViewerRow {
  id: string;
  personId: string;
  userId: string;
  viewCount: number;
  firstViewedAt: string;
  lastViewedAt: string;
  user: { id: string; name: string; email: string };
}

export function fetchViewers(personId: string) {
  return call<{ viewers: ViewerRow[] }>(`/api/people/${personId}/view`);
}

export function toggleFavorite(personId: string) {
  return call<{ favorited: boolean }>(`/api/favorites/${personId}`, { method: "POST" });
}

export function fetchFavorites() {
  return call<{ favorites: { personId: string; person: Record<string, unknown> }[] }>("/api/favorites");
}

export interface JobSummary {
  id: string;
  title: string;
  location?: string | null;
  isArchived: boolean;
  _count?: { candidates: number };
}

export function fetchJobs() {
  return call<{ jobs: JobSummary[] }>("/api/jobs");
}

export function createJob(title: string, location?: string) {
  return call<{ job: JobSummary }>("/api/jobs", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ title, location }),
  });
}

export function fetchPipeline(jobId: string) {
  return call<{ job: JobSummary; byStage: Record<string, unknown[]> }>(`/api/jobs/${jobId}`);
}

export function addCandidateToJob(jobId: string, personId: string) {
  return call<{ candidate: { id: string; stage: string } }>(`/api/jobs/${jobId}/candidates`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ personId }),
  });
}

export function changeStage(jobId: string, personId: string, stage: string) {
  return call<{ candidate: { id: string; stage: string } }>(
    `/api/jobs/${jobId}/candidates/${personId}`,
    { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ stage }) },
  );
}

export interface StageEventRow {
  id: string;
  fromStage: string | null;
  toStage: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export function fetchStageHistory(jobId: string, personId: string) {
  return call<{ events: StageEventRow[] }>(`/api/jobs/${jobId}/candidates/${personId}/history`);
}

export interface WatchlistSummary {
  id: string;
  name: string;
  isShared: boolean;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  _count?: { items: number };
}

export function fetchWatchlists() {
  return call<{ watchlists: WatchlistSummary[] }>("/api/watchlists");
}

export function createWatchlist(name: string, isShared: boolean) {
  return call<{ watchlist: WatchlistSummary }>("/api/watchlists", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name, isShared }),
  });
}

export interface WatchlistItemRow {
  id: string;
  personId: string;
  addedAt: string;
  addedBy: { id: string; name: string };
  person: Record<string, unknown>;
}

export function fetchWatchlist(watchlistId: string) {
  return call<{ watchlist: WatchlistSummary; items: WatchlistItemRow[] }>(
    `/api/watchlists/${watchlistId}`,
  );
}

export function setWatchlistSharing(watchlistId: string, isShared: boolean) {
  return call<{ watchlist: WatchlistSummary }>(`/api/watchlists/${watchlistId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ isShared }),
  });
}

export function deleteWatchlist(watchlistId: string) {
  return call<{ deleted: boolean }>(`/api/watchlists/${watchlistId}`, { method: "DELETE" });
}

export function addToWatchlist(watchlistId: string, personId: string) {
  return call<{ item: WatchlistItemRow }>(`/api/watchlists/${watchlistId}/items`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ personId }),
  });
}

export function removeFromWatchlist(watchlistId: string, personId: string) {
  return call<{ removed: boolean }>(`/api/watchlists/${watchlistId}/items/${personId}`, {
    method: "DELETE",
  });
}
