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
 * Structured, user-facing explanation of a candidate source, written for a
 * non-technical HR user deciding whether to run a search against it before
 * they run it — not an engineer reading the code. Deliberately kept as
 * separate, specific fields rather than one paragraph of prose: it lets the
 * UI lay each fact out on its own (what it searches, what it can't give
 * you, whether it costs money, its limits) instead of a wall of text no one
 * reads, and it lets each fact be checked/reviewed on its own rather than
 * disappearing into a blob. Every field should be concrete and honest —
 * this is what stands between the user and a wrong assumption about what a
 * source actually reaches (e.g. assuming "GitHub" also searches LinkedIn).
 */
export interface SourceDescription {
  /** One or two plain sentences: what this source actually searches. Should
   * name what it does NOT search when that is the likely wrong assumption
   * (e.g. GitHub vs. LinkedIn/Indeed/Glassdoor). */
  searches: string;
  /** Fields this source reliably returns, in plain HR language (e.g. "name",
   * "current company") — not raw Candidate/SearchFilters keys. */
  reliablyReturns: string[];
  /** What this source genuinely cannot provide — the gaps a user would
   * otherwise assume are just missing for one candidate, rather than never
   * available from this source at all. */
  cannotProvide: string[];
  /** Whether/how this source costs money, in plain language, e.g. "Free" or
   * "Paid — billed per profile scraped". */
  cost: string;
  /** Rate limits and/or setup requirements, in plain language. */
  setupAndLimits: string;
  /** Whether a search can be run against this source right now with zero
   * additional setup (credentials, configuration, explicit acknowledgement).
   * Drives whether the UI presents it as ready vs. "not set up yet". */
  readyNow: boolean;
  /** Optional extra honest caveats that don't fit the fields above, e.g.
   * which roles a source suits best, or a known data-quality quirk. */
  notes?: string[];
}

/**
 * Runtime check that a `SourceDescription` is actually filled in (not just
 * present) — every text field non-blank, every list field non-empty. TS
 * already forces `CandidateSource.description` to exist at compile time;
 * this catches the equally real failure mode of a source shipping with
 * empty strings/arrays that satisfy the type but tell the user nothing.
 * Used by the source-registry test so a future source cannot be registered
 * without a complete, honest description.
 */
export function isCompleteSourceDescription(
  d: SourceDescription | null | undefined,
): d is SourceDescription {
  if (!d) return false;
  const nonBlank = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
  const nonEmptyStringList = (arr: unknown): arr is string[] =>
    Array.isArray(arr) && arr.length > 0 && arr.every(nonBlank);
  return (
    nonBlank(d.searches) &&
    nonEmptyStringList(d.reliablyReturns) &&
    nonEmptyStringList(d.cannotProvide) &&
    nonBlank(d.cost) &&
    nonBlank(d.setupAndLimits) &&
    typeof d.readyNow === "boolean"
  );
}

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
  /**
   * User-facing explanation of what this source searches, what it can and
   * cannot provide, whether it costs money, and its rate limits/setup
   * requirements — see `SourceDescription`. Required (not optional) so a
   * source can never be registered without one; the UI reads this instead
   * of hardcoding prose about sources it does not own.
   */
  description: SourceDescription;
  /** Run a search against this source and return normalized Candidates. */
  search(filters: Partial<SearchFilters>, options?: SourceSearchOptions): Promise<Candidate[]>;
}
