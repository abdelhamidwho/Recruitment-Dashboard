import { describe, expect, it } from 'vitest'
import { buildQueryPreview, buildRankOnlyNote } from '@/components/SearchBuilder'
import { buildGithubUserQuery } from '@/lib/sources/github'
import { buildBooleanQuery } from '@/lib/buildBooleanQuery'

/**
 * Covers the source-dependent "query preview" panel (defect: the preview
 * always showed the LinkedIn-style boolean string, even when GitHub was the
 * selected source and a completely different query was actually sent).
 */
describe('buildQueryPreview', () => {
  const filters = {
    titles: ['Data Engineer', 'Data Analytics Engineer'],
    mustHave: ['SQL', 'Python', 'Airflow', 'Snowflake'],
    niceToHave: ['dbt', 'AWS', 'Spark'],
    location: ['Cairo, Egypt'],
  }

  it('shows the real GitHub q= query when github is selected, matching buildGithubUserQuery', () => {
    const preview = buildQueryPreview('github', filters)
    expect(preview).toBe(buildGithubUserQuery(filters))
    // Sanity: this must NOT be the LinkedIn-style boolean string.
    expect(preview).not.toContain(' OR ')
    expect(preview).toContain('type:user')
  })

  it('shows the LinkedIn-style boolean string for any other source (e.g. apify)', () => {
    const preview = buildQueryPreview('apify', filters)
    expect(preview).toBe(buildBooleanQuery(filters))
    expect(preview).not.toContain('type:user')
  })
})

describe('buildRankOnlyNote', () => {
  it('returns "" when there is nothing rank-only to report', () => {
    expect(buildRankOnlyNote('GitHub', [])).toBe('')
  })

  it('explains that the listed fragments still rank results even though they are not searched on', () => {
    const note = buildRankOnlyNote('GitHub', [
      'nice-to-have skills (dbt, AWS, Spark)',
      "must-have skills GitHub can't search on directly (Airflow, Snowflake)",
    ])
    expect(note).toContain('GitHub')
    expect(note).toContain('nice-to-have skills (dbt, AWS, Spark)')
    expect(note).toContain("must-have skills GitHub can't search on directly (Airflow, Snowflake)")
    expect(note.toLowerCase()).toContain("won't use")
    expect(note.toLowerCase()).toContain('rank')
  })
})
