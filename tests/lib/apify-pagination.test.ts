import { describe, expect, it, vi } from 'vitest'
import { paginateItems, APIFY_DATASET_PAGE_SIZE } from '@/lib/apify'

describe('paginateItems', () => {
  it('pages until the requested limit is reached', async () => {
    const all = Array.from({ length: 30 }, (_, i) => i)
    const fetchPage = vi.fn(async (offset: number, take: number) => all.slice(offset, offset + take))

    const result = await paginateItems(fetchPage, 25, 10)

    expect(result).toEqual(all.slice(0, 25))
    // 10 + 10 + 5 = 25, so three pages, the last one asking for only 5.
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 10)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 10, 10)
    expect(fetchPage).toHaveBeenNthCalledWith(3, 20, 5)
  })

  it('stops early when the source is exhausted before the limit', async () => {
    const all = Array.from({ length: 12 }, (_, i) => i)
    const fetchPage = vi.fn(async (offset: number, take: number) => all.slice(offset, offset + take))

    const result = await paginateItems(fetchPage, 50, 10)

    expect(result).toEqual(all)
    // page 1 returns 10 (== requested, keep going), page 2 returns 2 (< requested 10, stop)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('stops immediately on an empty first page', async () => {
    const fetchPage = vi.fn(async () => [])
    const result = await paginateItems(fetchPage, 50, 10)
    expect(result).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('never fetches more pages than a misbehaving API could stall on', async () => {
    // A pathological fetchPage that always returns exactly `take` items,
    // never signalling exhaustion, must not loop forever.
    const fetchPage = vi.fn(async (_offset: number, take: number) => new Array(take).fill(0))
    const result = await paginateItems(fetchPage, 47, 10)
    expect(result).toHaveLength(47)
    // ceil(47/10) + 5 = 10 is the safety cap; well under it here since it
    // actually satisfies the limit in ceil(47/10) = 5 calls.
    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(10)
  })

  it('respects a limit of zero without calling fetchPage', async () => {
    const fetchPage = vi.fn(async () => [1, 2, 3])
    const result = await paginateItems(fetchPage, 0, 10)
    expect(result).toEqual([])
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('defaults to the module page size when none is given', async () => {
    const fetchPage = vi.fn(async (_offset: number, take: number) => new Array(take).fill(0))
    await paginateItems(fetchPage, APIFY_DATASET_PAGE_SIZE + 1)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, APIFY_DATASET_PAGE_SIZE)
  })
})
