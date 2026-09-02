import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function migrationSql(match: string): string {
  const root = join(process.cwd(), 'prisma', 'migrations')
  const dir = readdirSync(root).find((name) => name.includes(match))
  if (!dir) throw new Error(`no migration directory matching "${match}"`)
  return readFileSync(join(root, dir, 'migration.sql'), 'utf8')
}

describe('candidate to person migration', () => {
  let db: Database.Database
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hrd-mig-'))
    const file = join(tempDir, 'test.db')
    db = new Database(file)
    db.exec(migrationSql('0_init'))

    const run = db.prepare(
      `INSERT INTO "SearchRun" ("id","status","filters","itemCount","createdAt","updatedAt")
       VALUES (?,?,?,?,?,?)`,
    )
    run.run('run-1', 'SUCCEEDED', '{}', 2, 1000, 1000)
    run.run('run-2', 'SUCCEEDED', '{}', 1, 2000, 2000)

    const candidate = db.prepare(
      `INSERT INTO "Candidate"
        ("id","externalId","fullName","profileUrl","location","skills","experience","education",
         "raw","score","scoreBreakdown","searchRunId","createdAt","updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    // Jane appears in both runs, and twice within run-1
    candidate.run('c1', 'x1', 'Jane Doe', 'https://li/jane', 'Cairo, Egypt', '[]', '[]', '[]', '{}', 60, '[]', 'run-1', 1000, 1000)
    candidate.run('c2', 'x1', 'Jane Doe', 'https://li/jane', 'Cairo, Egypt', '[]', '[]', '[]', '{}', 65, '[]', 'run-1', 1001, 1001)
    candidate.run('c3', 'x1', 'Jane D.', 'https://li/jane', 'Cairo, Egypt', '[]', '[]', '[]', '{}', 70, '[]', 'run-2', 2000, 2000)
    // Ahmed appears once
    candidate.run('c4', 'x2', 'Ahmed Karim', 'https://li/ahmed', 'Dubai, UAE', '[]', '[]', '[]', '{}', 50, '[]', 'run-1', 1000, 1000)

    db.exec(migrationSql('phase1_foundation'))
  })

  afterAll(() => {
    // Without this each run leaves an hrd-mig-* directory in the OS temp dir.
    db?.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates exactly one Person per distinct profile url', () => {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM "Person"').get() as { count: number }
    expect(count).toBe(2)
  })

  it('keeps the most recently updated version of a duplicated person', () => {
    const person = db
      .prepare('SELECT "fullName" FROM "Person" WHERE "profileUrl" = ?')
      .get('https://li/jane') as { fullName: string }
    expect(person.fullName).toBe('Jane D.')
  })

  it('records one appearance per run per person, not one per old row', () => {
    const rows = db
      .prepare(
        `SELECT srp."searchRunId" AS runId, srp."score" AS score
           FROM "SearchRunPerson" srp
           JOIN "Person" p ON p."id" = srp."personId"
          WHERE p."profileUrl" = ?
          ORDER BY srp."searchRunId"`,
      )
      .all('https://li/jane') as { runId: string; score: number }[]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.runId)).toEqual(['run-1', 'run-2'])
  })

  it('loses nobody', () => {
    const { count } = db
      .prepare('SELECT COUNT(*) AS count FROM "SearchRunPerson"')
      .get() as { count: number }
    expect(count).toBe(3)
  })

  it('drops the old Candidate table', () => {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='Candidate'`)
      .get()
    expect(row).toBeUndefined()
  })

  it('carries the location across as locationRaw for the backfill to normalise', () => {
    const person = db
      .prepare('SELECT "locationRaw", "country" FROM "Person" WHERE "profileUrl" = ?')
      .get('https://li/ahmed') as { locationRaw: string; country: string | null }
    expect(person.locationRaw).toBe('Dubai, UAE')
    expect(person.country).toBeNull()
  })
})
