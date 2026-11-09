import { SourceDescription } from "./types";

/**
 * User-facing description of the LinkedIn (Apify) path — kept here rather
 * than on `src/lib/apify.ts` because that module owns its own async
 * run/poll lifecycle and does not implement `CandidateSource` (see the
 * comment on `REGISTRY` in `./index.ts`), so there is no `CandidateSource`
 * object to hang a `description` field off of. This is the single source
 * of truth the UI reads instead of hardcoding prose about a source it does
 * not own; keep it in sync with `src/lib/apify.ts` and README.md's
 * "Candidate sources" section if the gating logic there changes.
 */
export const APIFY_SOURCE_DESCRIPTION: SourceDescription = {
  searches:
    "Scrapes LinkedIn profiles through the configured Apify actor (HarvestAPI profile search) — " +
    "this is the only source here that reaches LinkedIn.",
  reliablyReturns: [
    "Name, headline, current job and company, location, skills, experience, education, " +
      "certifications and languages (Full mode).",
  ],
  cannotProvide: [
    "Some profiles are skipped when LinkedIn rate-limits the actor, so a run can return fewer " +
      "profiles than requested.",
  ],
  cost: "Paid — billed per profile scraped, through your own Apify account.",
  setupAndLimits:
    "Needs APIFY_TOKEN, APIFY_ACTOR_ID and APIFY_ACTOR_INPUT_VERIFIED=true in .env. Apify's free " +
    "plan stops this actor after 10 runs; a paid plan lifts that.",
  readyNow: true,
  notes: [
    "Write locations as City, Country (for example \"Giza, Egypt\") — a bare city name often matches the wrong country. " +
      "Uses the HarvestAPI profile-search actor. On Apify's free plan the actor stops after 10 runs; " +
      "a paid plan is needed beyond that. Title and location narrow what is scraped; seniority, " +
      "years, must-have skills and excluded titles are also sent, so many filters can return nothing.",
  ],
};

/**
 * A candidate source the user asked about by name that this dashboard does
 * not, and likely will not, offer — as opposed to `CandidateSource`, which
 * is something that can actually run a search. Modeled as its own small
 * type rather than forced into `CandidateSource` (which requires a working
 * `search()`) because these have no search to run at all; presenting them
 * as a disabled/greyed "source" that still implements the same interface
 * would be misleading about why they're absent, and would need a fake
 * `search()` that only throws. A one-line, plain-language `reason` is all
 * the UI needs to show — there's nothing else to say about a source that
 * fundamentally doesn't hold candidate data.
 */
export interface UnavailableSource {
  /** Stable id, used only as a React key — these are never sent to the API. */
  id: string;
  /** Human-readable name, e.g. "Indeed". */
  label: string;
  /** One plain sentence explaining why this isn't offered as a source. */
  reason: string;
}

/**
 * Sources the user explicitly asked about ("is it LinkedIn or Indeed or
 * Glassdoor?") that are not, and are not becoming, selectable here. Shown
 * in the UI so their absence reads as "deliberately out of scope" rather
 * than "coming soon" or "broken".
 */
export const UNAVAILABLE_SOURCES: UnavailableSource[] = [
  {
    id: "indeed",
    label: "Indeed",
    reason:
      "Indeed's public site lists job postings, not candidates, and its resume database needs an " +
      "approved employer API this dashboard doesn't have.",
  },
  {
    id: "glassdoor",
    label: "Glassdoor",
    reason: "Glassdoor holds company reviews and salary data, not candidate profiles.",
  },
];
