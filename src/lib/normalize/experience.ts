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

function parseDate(value: string | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
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

export function totalYearsOfExperience(
  entries: ExperienceEntry[] | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!entries || entries.length === 0) return null

  const intervals: Interval[] = []
  let looseMonths = 0

  for (const entry of entries) {
    const start = parseDate(entry.from)
    if (start !== null) {
      const end = parseDate(entry.to) ?? now.getTime()
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
