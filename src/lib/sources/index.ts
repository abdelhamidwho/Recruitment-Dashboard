import { CandidateSource } from "./types";
import { githubSource } from "./github";

// Registry of candidate sources. Deliberately does NOT register/import the
// Apify (LinkedIn) source — that module is owned by a concurrent change and
// will be wired in separately once it's adapted to this contract.
const REGISTRY: Record<string, CandidateSource> = {
  [githubSource.id]: githubSource,
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

export type { CandidateSource, SourceSearchOptions, UnsupportedField } from "./types";
