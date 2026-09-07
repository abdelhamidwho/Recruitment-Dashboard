import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '../../generated/prisma/client'
import type { Candidate } from '@/lib/apify'

/**
 * Applies every migration under prisma/migrations, in directory order, to a
 * fresh temp sqlite file. Mirrors the migration-application approach in
 * tests/migration/candidate-to-person.test.ts, so this test exercises the
 * real (current) schema rather than a hand-copied subset of it.
 */
function applyAllMigrations(file: string): void {
  const root = join(process.cwd(), 'prisma', 'migrations')
  const dirs = readdirSync(root)
    .filter((name) => name !== 'migration_lock.toml')
    .sort()
  const db = new Database(file)
  try {
    for (const dir of dirs) {
      const sql = readFileSync(join(root, dir, 'migration.sql'), 'utf8')
      db.exec(sql)
    }
  } finally {
    db.close()
  }
}

const tempDir = mkdtempSync(join(tmpdir(), 'hrd-profile-storage-'))
const dbFile = join(tempDir, 'test.db')
applyAllMigrations(dbFile)
const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` })
const testPrisma = new PrismaClient({ adapter })

// profileStorage.ts imports the app's singleton `prisma` from src/lib/prisma,
// which connects to process.env.DATABASE_URL (the real dev.db) at module
// load. Mocking the module (rather than pointing at dev.db, or trying to
// mutate the live-bound export after the fact) is what lets this test run
// against an isolated temp database instead of the app's own data.
vi.mock('@/lib/prisma', () => ({ prisma: testPrisma }))

const { upsertPerson, recordAppearance } = await import('@/lib/profileStorage')

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    externalId: 'ext-1',
    fullName: 'Omar Ali',
    headline: 'Backend Engineer',
    currentTitle: undefined,
    currentCompany: 'Acme',
    location: 'Cairo, Egypt',
    profileUrl: 'https://github.com/omarali',
    avatarUrl: undefined,
    summary: 'Python backend engineer',
    industry: undefined,
    skills: [],
    experience: [],
    education: [],
    languages: [],
    certifications: [],
    totalYearsExperience: undefined,
    raw: {},
    ...overrides,
  }
}

describe('profileStorage', () => {
  afterAll(async () => {
    await testPrisma.$disconnect()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates a new Person on first upsert, recording its source', async () => {
    const { person, wasKnownBefore } = await upsertPerson(candidate(), 'github')
    expect(wasKnownBefore).toBe(false)
    expect(person.source).toBe('github')
    expect(person.fullName).toBe('Omar Ali')
    expect(person.city).toBe('Cairo')
  })

  it('dedupes a second upsert of the same profileUrl: wasKnownBefore is true, no new row', async () => {
    const before = await testPrisma.person.count()
    const { wasKnownBefore, person } = await upsertPerson(
      candidate({ fullName: 'Omar A. Ali' }),
      'github',
    )
    const after = await testPrisma.person.count()
    expect(wasKnownBefore).toBe(true)
    expect(after).toBe(before)
    expect(person.fullName).toBe('Omar A. Ali') // update() overwrites, matching upsertPerson's contract
  })

  it('recordAppearance upserts the person and records a SearchRunPerson row with a score', async () => {
    const run = await testPrisma.searchRun.create({
      data: { source: 'github', filters: '{}', status: 'SUCCEEDED' },
    })

    const { person, wasKnownBefore, score } = await recordAppearance(
      run.id,
      candidate({ profileUrl: 'https://github.com/danielsameh', fullName: 'Daniel Sameh' }),
      { mustHave: ['Python'] },
      'github',
    )

    expect(wasKnownBefore).toBe(false)
    expect(typeof score).toBe('number')

    const appearance = await testPrisma.searchRunPerson.findUnique({
      where: { searchRunId_personId: { searchRunId: run.id, personId: person.id } },
    })
    expect(appearance).not.toBeNull()
    expect(appearance?.score).toBe(score)
  })

  it('recordAppearance called twice for the same run+person updates rather than duplicating', async () => {
    const run = await testPrisma.searchRun.create({
      data: { source: 'github', filters: '{}', status: 'SUCCEEDED' },
    })
    const c = candidate({ profileUrl: 'https://github.com/andrewanter', fullName: 'Andrew Anter' })

    await recordAppearance(run.id, c, {}, 'github')
    await recordAppearance(run.id, c, {}, 'github')

    const appearances = await testPrisma.searchRunPerson.findMany({ where: { searchRunId: run.id } })
    expect(appearances).toHaveLength(1)
  })
})
