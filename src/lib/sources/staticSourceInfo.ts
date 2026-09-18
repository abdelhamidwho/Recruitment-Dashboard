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
    "Once configured, scrapes LinkedIn profiles using an Apify actor you choose — this is the only " +
    "source here that reaches LinkedIn.",
  reliablyReturns: [
    "Depends entirely on the actor you configure — not yet verified against a real actor's output.",
  ],
  cannotProvide: [
    "Nothing is confirmed yet: the field mapping (buildActorInput()/mapToCandidate() in " +
      "src/lib/apify.ts) is a provisional placeholder for a generic LinkedIn scraper actor, not " +
      "checked against your chosen actor's real input/output schema.",
  ],
  cost: "Paid — billed per profile scraped, through your own Apify account.",
  setupAndLimits:
    "Requires an Apify account, an APIFY_TOKEN, and an APIFY_ACTOR_ID you choose. Run " +
    "`npm run apify:probe` to verify the actor's real input/output shape, then set " +
    "APIFY_ACTOR_INPUT_VERIFIED=true before a real (billed) run is allowed. Until then, searches " +
    "against this source return mock data only.",
  readyNow: false,
  notes: [
    "Not configured in this deployment yet — live runs are deliberately blocked until the actor " +
      "input mapping above is explicitly verified, so a malformed request can't be sent (and billed) " +
      "before anyone has checked it.",
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
