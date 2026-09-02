export interface ExperienceEntry {
  title?: string
  company?: string
  from?: string
  to?: string
  durationMonths?: number
}

interface Interval {
  start: number
  end: number
}

const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000

function parseDate(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

function isEntry(value: unknown): value is ExperienceEntry {
  return typeof value === 'object' && value !== null
}

function mergedMonths(intervals: Interval[]): number {
  if (intervals.length === 0) return 0
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  let total = 0
  let { start, end } = sorted[0]

  for (const interval of sorted.slice(1)) {
    if (interval.start <= end) {
      end = Math.max(end, interval.end)
    } else {
      total += end - start
      start = interval.start
      end = interval.end
    }
  }
  total += end - start
  return total / MS_PER_MONTH
}

/**
 * Computes total years of professional experience from a candidate's history,
 * merging overlapping employment ranges so concurrent roles are not double-counted.
 *
 * Contract:
 * - Entries with a parseable `from` (and a parseable `to`, or none) become date
 *   intervals and are merged before measuring, so two concurrent or overlapping
 *   roles only count the union of their time, not the sum.
 * - Touching ranges — one range's `to` exactly equal to the next range's `from` —
 *   are merged as continuous employment, not treated as a gap.
 * - Entries carrying only `durationMonths` (no usable dates) are added on top of
 *   the merged date-based total, because without dates there is no way to detect
 *   whether they overlap with anything else.
 * - A missing `to`, or a `to` that cannot be parsed (e.g. "Present", "Current",
 *   or other free text a scraper might emit for an ongoing role), is treated as
 *   "still employed" and measured through to `now`. This is deliberate: the
 *   common real-world case is an ongoing role whose `to` field is exactly such
 *   free text rather than a date.
 * - A reversed or zero-length range (`to` at or before `from`) is nonsense and
 *   contributes no negative interval; it deliberately falls back to that entry's
 *   `durationMonths` if present, otherwise the entry contributes nothing.
 * - A `durationMonths` that is negative, `NaN`, or not a number is silently
 *   ignored. This function never throws and never logs — a scraper producing
 *   bad values simply does not surface here; that is a separate concern.
 * - Robustness against malformed scraper input: `entries` itself may be `null`, `undefined`,
 *   or a truthy non-array (a number, a string, or a plain object) — treated the same as "no
 *   data" rather than crashing on iteration. Within an array, an element may itself contain
 *   `null`, `undefined`, or other non-object elements (raw scraped JSON is
 *   typed as `any`, so this is genuinely reachable) — such elements are
 *   skipped and the remaining entries are still processed, rather than one
 *   junk element destroying the whole calculation. Likewise, a `from` or `to`
 *   that is not a string (a number, array, object, etc.) is treated as absent
 *   rather than being coerced into a date — coercion can otherwise produce a
 *   bogus interval (e.g. `Date.parse` on a small number resolves to a real,
 *   nonsensical date decades away) instead of leaving the value out.
 * - Returns `null` when there is nothing to measure (no entries, or no entry
 *   yields any usable interval or duration) — never `0` for "no data". A real,
 *   very short tenure (e.g. a two-week contract) can legitimately round to the
 *   number `0`, and that is real data, not "no data". Callers must not treat a
 *   `0` return as absence — conflating the two is the exact bug this module
 *   exists to fix (the current scorer treats a missing value as zero years and
 *   penalises candidates for experience they actually have).
 *
 * @param now - Clock to measure ongoing roles against. Defaults to `new Date()`;
 *   callers that need determinism (tests) should pass a fixed value.
 */
export function totalYearsOfExperience(
  entries: ExperienceEntry[] | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!Array.isArray(entries) || entries.length === 0) return null

  const intervals: Interval[] = []
  let looseMonths = 0

  for (const entry of entries) {
    if (!isEntry(entry)) continue
    const start = parseDate(entry.from)
    if (start !== null) {
      const end = parseDate(entry.to) ?? now.getTime()
      // A reversed or zero-length range (end <= start) is nonsense — e.g. bad
      // scraper data — and deliberately falls through to the durationMonths
      // fallback below rather than contributing a negative or empty interval.
      if (end > start) {
        intervals.push({ start, end })
        continue
      }
    }
    if (typeof entry.durationMonths === 'number' && entry.durationMonths > 0) {
      looseMonths += entry.durationMonths
    }
  }

  const months = mergedMonths(intervals) + looseMonths
  if (months <= 0) return null
  return Math.round((months / 12) * 10) / 10
}
