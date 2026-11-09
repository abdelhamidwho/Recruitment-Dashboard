import { CandidateSource } from "./types";
import { githubSource } from "./github";
import { linkedinXraySource } from "./linkedinXray";

// Registry of candidate sources. Deliberately does NOT register/import the
// Apify (LinkedIn) source — that module is owned by a concurrent change and
// will be wired in separately once it's adapted to this contract.
const REGISTRY: Record<string, CandidateSource> = {
  [githubSource.id]: githubSource,
  [linkedinXraySource.id]: linkedinXraySource,
};

/** Looks up a source by id, throwing a clear error on an unknown one rather
 * than returning undefined for callers to trip over later. */
export function getSource(id: string): CandidateSource {
  const source = REGISTRY[id];
  if (!source) {
    const known = Object.keys(REGISTRY).join(", ") || "(none registered)";
    throw new Error(`Unknown candidate source "${id}". Known sources: ${known}.`);
  }
  return source;
}

export function listSources(): CandidateSource[] {
  return Object.values(REGISTRY);
}

/** The Apify/LinkedIn source's id. It is intentionally not registered above
 * (see the comment on REGISTRY) since it owns its own async run/poll
 * lifecycle rather than implementing CandidateSource — but POST /api/search
 * still needs to accept it as a legitimate, separately-handled source id. */
export const APIFY_SOURCE_ID = "apify";
/** What POST /api/search defaults to when no source is given: GitHub works
 * with no setup (just a lower rate limit without a token), unlike Apify's
 * LinkedIn path, which is blocked until a real actor is chosen and verified. */
export const DEFAULT_SOURCE_ID = "github";

/**
 * Validates a caller-supplied source id from POST /api/search's request
 * body. Defaults to DEFAULT_SOURCE_ID for a missing/blank value, accepts
 * APIFY_SOURCE_ID (handled by the async path, not this registry), and
 * otherwise defers to getSource()'s own "Unknown candidate source" error so
 * there is exactly one message for that case. Pure and side-effect free so
 * it's unit-testable without a request/response or the registry's network
 * calls.
 */
export function resolveRequestedSourceId(raw: unknown): string {
  const id = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_SOURCE_ID;
  if (id === APIFY_SOURCE_ID) return id;
  getSource(id); // throws "Unknown candidate source ..." for anything unregistered
  return id;
}

export type { CandidateSource, SourceSearchOptions, UnsupportedField, SourceDescription } from "./types";
export { isCompleteSourceDescription } from "./types";
export { APIFY_SOURCE_DESCRIPTION, UNAVAILABLE_SOURCES } from "./staticSourceInfo";
export type { UnavailableSource } from "./staticSourceInfo";
