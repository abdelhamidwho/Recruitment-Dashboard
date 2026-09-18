/**
 * Every scoring weight lives here, in one place, so tuning the ranking never
 * means hunting through rule files. Each number is the maximum number of
 * points that dimension can contribute to a candidate's soft score (see
 * `src/lib/scoring/index.ts` for how these are combined).
 *
 * Two things these weights are deliberately NOT:
 * - Not a sum that has to equal 100. `scoreCandidate` normalizes by the
 *   total weight of whatever dimensions actually applied to a given
 *   candidate/search (see `index.ts`'s `applicableMax`), so a search that
 *   only sets two filters is still scored out of 100, not out of a fraction
 *   of a fixed budget. These numbers only express *relative* importance
 *   between dimensions when more than one applies.
 * - Not used for must-have skills or excluded keywords. Those are hard
 *   gates (`src/lib/scoring/gates.ts`): a missing must-have or a hit on an
 *   excluded keyword removes the candidate before soft scoring ever runs,
 *   rather than costing points.
 *
 * Rationale for the relative sizes:
 * - `niceToHaveSkills` and `titles` are what the recruiter explicitly typed
 *   into the search, so they carry the most weight.
 * - `education` is weighted with titles/skills because a hard degree
 *   requirement (e.g. "Bachelor's minimum") is usually as decisive to an
 *   HR user as a skill match.
 * - `seniorityLevel` + `experienceYears` together describe career stage;
 *   split so a search can set one without the other (e.g. a years range
 *   with no seniority label, or vice versa) and still get a meaningful
 *   score out of the part it did set.
 * - `location`, `languages`, and `industry` are refinements, not primary
 *   criteria, so each gets a smaller ceiling.
 */
export const WEIGHTS = {
  /** Nice-to-have skills, split evenly across however many were requested. */
  niceToHaveSkills: 20,
  /** Candidate's title/headline matching one of the requested job titles. */
  titles: 15,
  /** Highest degree meeting the requested minimum. */
  education: 15,
  /** Candidate's title/headline containing a requested seniority word
   * (e.g. "Senior", "Staff"). */
  seniorityLevel: 8,
  /** Years of experience falling inside [yearsMin, yearsMax]. */
  experienceYears: 7,
  /** Candidate's city/country/region matching a requested location. */
  location: 10,
  /** Spoken languages, split evenly across however many were requested. */
  languages: 10,
  /** Candidate's normalized industry matching a requested one. */
  industry: 10,
} as const;

/** Score returned when literally no dimension was applicable — no filters
 * set anything scorable, or the source can't supply any of it. Neutral, not
 * zero: an unscored candidate should not look disqualified. */
export const NEUTRAL_FALLBACK_SCORE = 50;
