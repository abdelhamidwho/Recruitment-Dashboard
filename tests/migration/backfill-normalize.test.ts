import { describe, expect, it } from 'vitest'
import {
  runBackfill,
  type BackfillClient,
  type NormalizationUpdate,
  type PersonInput,
} from '../../prisma/backfill-normalize-lib'

function person(overrides: Partial<PersonInput>): PersonInput {
  return {
    id: 'id',
    fullName: 'name',
    raw: '{}',
    locationRaw: null,
    education: '[]',
    languages: '[]',
    experience: '[]',
    currentCompany: null,
    ...overrides,
  }
}

/**
 * A fake client whose `update` throws for one chosen person id, so the test can drive
 * runBackfill's per-row isolation without a real database.
 */
function fakeClient(
  people: PersonInput[],
  failingId: string,
): { client: BackfillClient; updates: { id: string; data: NormalizationUpdate }[] } {
  const updates: { id: string; data: NormalizationUpdate }[] = []
  const client: BackfillClient = {
    person: {
      findMany: async () => people,
      update: async ({ where, data }) => {
        if (where.id === failingId) {
          throw new Error(`boom on ${where.id}`)
        }
        updates.push({ id: where.id, data })
        return null
      },
    },
  }
  return { client, updates }
}

describe('runBackfill', () => {
  it('isolates one failing row: the other rows still update, the failure is reported, and it signals overall failure', async () => {
    const people = [
      person({ id: 'good-1', fullName: 'Jane Doe', locationRaw: 'San Francisco, CA' }),
      person({ id: 'bad-1', fullName: 'Rigged Row', locationRaw: 'Cairo, Egypt' }),
      person({ id: 'good-2', fullName: 'John Smith', locationRaw: 'Remote' }),
    ]
    const { client, updates } = fakeClient(people, 'bad-1')

    const result = await runBackfill(client)

    // The two rows either side of the rigged failure were still updated...
    expect(updates.map((u) => u.id).sort()).toEqual(['good-1', 'good-2'])
    // ...while the whole run correctly reports the mixed outcome rather than silently
    // succeeding or aborting entirely.
    expect(result.examined).toBe(3)
    expect(result.updated).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.failures).toEqual([{ id: 'bad-1', fullName: 'Rigged Row', error: 'boom on bad-1' }])
  })

  it('reports zero failures and updates every row when nothing throws', async () => {
    const people = [person({ id: 'a' }), person({ id: 'b' })]
    const { client, updates } = fakeClient(people, 'nonexistent')

    const result = await runBackfill(client)

    expect(result).toMatchObject({ examined: 2, updated: 2, failed: 0, failures: [] })
    expect(updates).toHaveLength(2)
  })
})
