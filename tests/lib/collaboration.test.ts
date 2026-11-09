import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '../../generated/prisma/client'
import { createTestDb, hasTestDb } from '../helpers/pgTestDb'

const db = hasTestDb ? await createTestDb() : undefined
const testPrisma = db?.prisma as PrismaClient

vi.mock('@/lib/prisma', () => ({ prisma: testPrisma }))

const {
  createJob,
  addCandidateToJob,
  changeStage,
  getPipeline,
  getStageHistory,
  recordView,
  getViewers,
  createWatchlist,
  listWatchlistsFor,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setWatchlistSharing,
  deleteWatchlist,
  toggleFavorite,
  listFavorites,
  getCollaborationState,
  CollaborationError,
} = await import('@/lib/collaboration')

let userA: string
let userB: string
let person1: string
let person2: string
let person3: string

beforeAll(async () => {
  if (!hasTestDb) return
  const a = await testPrisma.user.create({
    data: { email: 'sara@example.com', name: 'Sara', passwordHash: 'x' },
  })
  const b = await testPrisma.user.create({
    data: { email: 'ken@example.com', name: 'Ken', passwordHash: 'x' },
  })
  userA = a.id
  userB = b.id

  const p1 = await testPrisma.person.create({
    data: { profileUrl: 'https://github.com/p1', fullName: 'Person One' },
  })
  const p2 = await testPrisma.person.create({
    data: { profileUrl: 'https://github.com/p2', fullName: 'Person Two' },
  })
  const p3 = await testPrisma.person.create({
    data: { profileUrl: 'https://github.com/p3', fullName: 'Person Three' },
  })
  person1 = p1.id
  person2 = p2.id
  person3 = p3.id
})

afterAll(async () => {
  await db?.cleanup()
})

describe.skipIf(!hasTestDb)('jobs & pipeline', () => {
  it('creates a job and adds a candidate at the default stage, recording an initial StageEvent', async () => {
    const job = await createJob(userA, { title: 'Backend Engineer' })
    const candidate = await addCandidateToJob(job.id, person1, userA)
    expect(candidate.stage).toBe('Sourced')
    expect(candidate.ownerId).toBe(userA)

    const history = await getStageHistory(job.id, person1)
    expect(history).toHaveLength(1)
    expect(history[0].fromStage).toBeNull()
    expect(history[0].toStage).toBe('Sourced')
    expect(history[0].userId).toBe(userA)
  })

  it('adding the same candidate twice is idempotent (no duplicate, no error)', async () => {
    const job = await createJob(userA, { title: 'Idempotency Role' })
    const first = await addCandidateToJob(job.id, person1, userA)
    const second = await addCandidateToJob(job.id, person1, userB)
    expect(second.id).toBe(first.id)

    const count = await testPrisma.jobCandidate.count({ where: { jobId: job.id, personId: person1 } })
    expect(count).toBe(1)
  })

  it('moves a candidate through two stages and records each StageEvent, setting updatedById', async () => {
    const job = await createJob(userA, { title: 'Two Stage Role' })
    await addCandidateToJob(job.id, person2, userA)

    await changeStage(job.id, person2, 'Contacted', userA)
    const updated = await changeStage(job.id, person2, 'Screening', userB)

    expect(updated.stage).toBe('Screening')
    expect(updated.updatedById).toBe(userB)

    const history = await getStageHistory(job.id, person2)
    expect(history.map((e) => [e.fromStage, e.toStage])).toEqual([
      [null, 'Sourced'],
      ['Sourced', 'Contacted'],
      ['Contacted', 'Screening'],
    ])
  })

  it('rejects an invalid stage value with a CollaborationError(400)', async () => {
    const job = await createJob(userA, { title: 'Validation Role' })
    await addCandidateToJob(job.id, person1, userA)

    await expect(changeStage(job.id, person1, 'NotAStage', userA)).rejects.toMatchObject({
      status: 400,
    })
    expect(CollaborationError).toBeDefined()
  })

  it('groups a pipeline by stage', async () => {
    const job = await createJob(userA, { title: 'Pipeline Role' })
    await addCandidateToJob(job.id, person1, userA)
    await addCandidateToJob(job.id, person2, userA)
    await changeStage(job.id, person2, 'Interview', userA)

    const { byStage } = await getPipeline(job.id)
    expect(byStage.Sourced.map((c) => c.personId)).toContain(person1)
    expect(byStage.Interview.map((c) => c.personId)).toContain(person2)
  })
})

describe.skipIf(!hasTestDb)('profile views', () => {
  it('records a view once, then a second view by the same user increments viewCount instead of creating a row', async () => {
    await recordView(person3, userA)
    const second = await recordView(person3, userA)

    expect(second.viewCount).toBe(2)

    const rows = await testPrisma.profileView.findMany({ where: { personId: person3, userId: userA } })
    expect(rows).toHaveLength(1)
  })

  it('tracks views per user independently', async () => {
    await recordView(person3, userB)
    const viewers = await getViewers(person3)
    const byUser = Object.fromEntries(viewers.map((v) => [v.userId, v.viewCount]))
    expect(byUser[userA]).toBe(2)
    expect(byUser[userB]).toBe(1)
  })
})

describe.skipIf(!hasTestDb)('watchlists — authorisation', () => {
  it('a private watchlist is invisible to another user, and visible once shared', async () => {
    const watchlist = await createWatchlist(userA, 'Sara private list', false)
    await addToWatchlist(watchlist.id, person1, userA)

    // userB cannot see it in their listing
    const listForB = await listWatchlistsFor(userB)
    expect(listForB.map((w) => w.id)).not.toContain(watchlist.id)

    // userB cannot fetch it directly either — 404, not 403 (never reveal existence)
    await expect(getWatchlist(watchlist.id, userB)).rejects.toMatchObject({ status: 404 })

    // userB cannot mutate it
    await expect(addToWatchlist(watchlist.id, person2, userB)).rejects.toMatchObject({ status: 403 })
    await expect(removeFromWatchlist(watchlist.id, person1, userB)).rejects.toMatchObject({ status: 403 })
    await expect(setWatchlistSharing(watchlist.id, userB, true)).rejects.toMatchObject({ status: 403 })

    // owner shares it
    await setWatchlistSharing(watchlist.id, userA, true)

    const listForBAfter = await listWatchlistsFor(userB)
    expect(listForBAfter.map((w) => w.id)).toContain(watchlist.id)
    const seen = await getWatchlist(watchlist.id, userB)
    expect(seen.items.map((i) => i.personId)).toContain(person1)
  })

  it('on a shared watchlist, any team member can add and remove people, but only the owner can share/unshare/delete', async () => {
    const watchlist = await createWatchlist(userA, 'Team list', true)

    // userB (not the owner) can add and remove because the list is shared
    await addToWatchlist(watchlist.id, person1, userB)
    const seen = await getWatchlist(watchlist.id, userB)
    expect(seen.items.map((i) => i.personId)).toContain(person1)
    expect(seen.items.find((i) => i.personId === person1)?.addedById).toBe(userB)

    await removeFromWatchlist(watchlist.id, person1, userB)
    const afterRemove = await getWatchlist(watchlist.id, userB)
    expect(afterRemove.items.map((i) => i.personId)).not.toContain(person1)

    // but userB still cannot share/unshare or delete
    await expect(setWatchlistSharing(watchlist.id, userB, false)).rejects.toMatchObject({ status: 403 })
    await expect(deleteWatchlist(watchlist.id, userB)).rejects.toMatchObject({ status: 403 })

    // the owner can still do everything, including delete
    await addToWatchlist(watchlist.id, person2, userA)
    await deleteWatchlist(watchlist.id, userA)
    await expect(getWatchlist(watchlist.id, userA)).rejects.toMatchObject({ status: 404 })
  })

  it('adding the same person twice is idempotent', async () => {
    const watchlist = await createWatchlist(userA, 'Idempotent list', false)
    await addToWatchlist(watchlist.id, person1, userA)
    await addToWatchlist(watchlist.id, person1, userA)

    const count = await testPrisma.watchlistItem.count({
      where: { watchlistId: watchlist.id, personId: person1 },
    })
    expect(count).toBe(1)
  })
})

describe.skipIf(!hasTestDb)('favorites — authorisation & idempotency', () => {
  it("one user's favourites are invisible to another", async () => {
    await toggleFavorite(userA, person1)
    const favA = await listFavorites(userA)
    const favB = await listFavorites(userB)
    expect(favA.map((f) => f.personId)).toContain(person1)
    expect(favB.map((f) => f.personId)).not.toContain(person1)
  })

  it('toggling twice returns to the original state', async () => {
    const target = person2
    const before = await testPrisma.favorite.findUnique({
      where: { userId_personId: { userId: userB, personId: target } },
    })
    expect(before).toBeNull()

    const on = await toggleFavorite(userB, target)
    expect(on.favorited).toBe(true)
    const off = await toggleFavorite(userB, target)
    expect(off.favorited).toBe(false)

    const after = await testPrisma.favorite.findUnique({
      where: { userId_personId: { userId: userB, personId: target } },
    })
    expect(after).toBeNull()
  })
})

describe.skipIf(!hasTestDb)('batch collaboration state', () => {
  it('returns per-person state in a fixed number of queries, not one per candidate', async () => {
    const job = await createJob(userA, { title: 'Batch Role' })
    await addCandidateToJob(job.id, person1, userA)
    await changeStage(job.id, person1, 'Interview', userA)
    const alreadyFavorited = (await listFavorites(userA)).some((f) => f.personId === person1)
    if (!alreadyFavorited) await toggleFavorite(userA, person1)
    const watchlist = await createWatchlist(userA, 'Batch list', false)
    await addToWatchlist(watchlist.id, person2, userA)
    await recordView(person1, userA)

    const ids = [person1, person2, person3]

    const state = await getCollaborationState(ids, userA)

    expect(state[person1].favorited).toBe(true)
    expect(state[person1].jobs).toContainEqual({ jobId: job.id, jobTitle: 'Batch Role', stage: 'Interview' })
    expect(state[person1].viewedBy.map((v) => v.userId)).toContain(userA)
    expect(state[person2].watchlists.map((w) => w.id)).toContain(watchlist.id)
    expect(state[person2].favorited).toBe(false)
    expect(state[person3].favorited).toBe(false)
    expect(state[person3].watchlists).toEqual([])
    expect(state[person3].jobs).toEqual([])
  })

  it('issues exactly four queries total regardless of how many personIds are passed', async () => {
    const queries: string[] = []
    const spyPrisma = testPrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query, operation, model }) {
            queries.push(`${model}.${operation}`)
            return query(args)
          },
        },
      },
    })
    vi.doMock('@/lib/prisma', () => ({ prisma: spyPrisma }))
    vi.resetModules()
    const { getCollaborationState: getStateSpy } = await import('@/lib/collaboration')

    queries.length = 0
    await getStateSpy([person1], userA)
    const countFor1 = queries.length

    queries.length = 0
    await getStateSpy([person1, person2, person3], userA)
    const countForMany = queries.length

    expect(countFor1).toBe(4)
    expect(countForMany).toBe(4)

    vi.doUnmock('@/lib/prisma')
    vi.resetModules()
  })

  it('returns an empty-but-shaped result for an empty id list with zero queries', async () => {
    const state = await getCollaborationState([], userA)
    expect(state).toEqual({})
  })
})
