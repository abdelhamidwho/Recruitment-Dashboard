import { Candidate } from "@/lib/apify";
import { SearchFilters } from "@/lib/buildBooleanQuery";

/**
 * Options that shape how a search executes, as opposed to `SearchFilters`
 * (what to search for). Kept separate so a source's auth/runtime concerns
 * don't leak into the filter shape the UI builds and every source shares.
 */
export interface SourceSearchOptions {
  /** Per-source credential/token, e.g. a GitHub personal access token. When
   * omitted a source should still function if it can (possibly at a lower
   * rate limit), per the "must work without a token" requirement. */
  token?: string;
}

/**
 * A field a source cannot populate at all, as opposed to one it looked for
 * and found nothing. Sources must be honest about this rather than silently
 * leaving a field `undefined` (which is indistinguishable from "not looked
 * up yet") — callers such as scoring need to tell "no data exists for this
 * source" apart from "this particular candidate has none".
 */
export type UnsupportedField = keyof Candidate | (string & {});

/**
 * The contract every candidate source implements. `apify.ts` remains the
 * LinkedIn source (owned separately, not registered here); this interface
 * is what lets `github.ts` and future sources (e.g. StackOverflow, X) feed
 * the same `normalizeProfile`/`scoreCandidate` pipeline without inventing a
 * parallel candidate shape.
 */
export interface CandidateSource {
  /** Stable machine id, e.g. "github". Used as the registry key and stored
   * on Person.source / SearchRun.source. */
  id: string;
  /** Human-readable name for UI display, e.g. "GitHub". */
  label: string;
  /**
   * Fields this source can never populate, regardless of the specific
   * candidate — e.g. GitHub has no employment history, so
   * `totalYearsExperience` belongs here. Distinct from a field that is
   * merely absent on one candidate's profile.
   */
  unsupportedFields: UnsupportedField[];
  /**
   * Which *filters* (as opposed to Candidate fields, see `unsupportedFields`
   * above) this source cannot act on at all, e.g. GitHub has no concept of
   * "years of experience". Used purely for UI messaging — telling the user a
   * filter they set will be ignored, rather than silently dropping it — and
   * is optional since a source with no gaps (or one not yet audited) simply
   * omits it.
   */
  unsupportedFilterFields?: (keyof SearchFilters)[];
  /**
   * Given the current filter values, returns human-readable fragments
   * describing sub-filters that this source deliberately excludes from its
   * retrieval query but still uses (via scoring, downstream of `search()`)
   * to rank results — e.g. GitHub can't require "Airflow" or a
   * nice-to-have skill in `q=` without emptying the result set, but
   * scoring.ts still matches them against the candidate's skills/summary.
   * Distinct from `unsupportedFilterFields`, which lists filters a source
   * has no way to act on at all, with no effect on ranking either. Optional
   * since a source with nothing excluded this way (or not yet audited)
   * simply omits it; the UI should treat a missing implementation the same
   * as one returning `[]`.
   */
  describeRankOnlyFilters?(filters: Partial<SearchFilters>): string[];
  /** Run a search against this source and return normalized Candidates. */
  search(filters: Partial<SearchFilters>, options?: SourceSearchOptions): Promise<Candidate[]>;
}
