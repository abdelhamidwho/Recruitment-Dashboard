import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'

const DATABASE_FILE = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './dev.db'

// Postgres-style connection strings support query parameters; SQLite file URLs do not.
// Silently stripping a deliberately-written setting (e.g. "?connection_limit=1") would be its
// own bug, so refuse to start rather than open a wrongly-named file or a file with a literal
// "?" in its name.
if (DATABASE_FILE.includes('?')) {
  throw new Error(
    `DATABASE_URL "${DATABASE_FILE}" contains a "?" — query parameters are not supported for ` +
      'SQLite connection strings. Remove everything from the "?" onward.',
  )
}

// better-sqlite3 is synchronous, so WAL is applied and verified here, synchronously, at module
// load, using a short-lived direct connection — rather than fired-and-forgotten against the
// adapter's own async connection where a failure (read-only mount, network share, locked file)
// would otherwise go unnoticed and the app would silently run on in rollback-journal mode,
// which cannot serve concurrent HR users. WAL is a persistent property of the database file
// itself, so setting it once here makes it durable for every later connection, including the
// adapter's own.
function ensureWal(file: string): void {
  const db = new Database(file)
  try {
    const mode = db.pragma('journal_mode = WAL', { simple: true }) as string
    if (mode !== 'wal') {
      throw new Error(
        `Failed to enable WAL journal mode on "${file}" (PRAGMA journal_mode reported ` +
          `"${mode}" instead of "wal"). Refusing to start: rollback-journal mode cannot serve ` +
          'concurrent HR users.',
      )
    }
  } finally {
    db.close()
  }
}

ensureWal(DATABASE_FILE)

function createClient() {
  // PrismaBetterSqlite3's config type is better-sqlite3's own `Options & { url }`, and the
  // adapter passes it straight through to `new Database(dbPath, config)` (see
  // node_modules/@prisma/adapter-better-sqlite3/dist/index.js, createBetterSQLite3Client) — so
  // `timeout` here becomes better-sqlite3's busy timeout on the adapter's own connection. This
  // is used in place of a fire-and-forgotten `PRAGMA busy_timeout` statement, since busy_timeout
  // is per-connection and must reach the adapter's own connection to have any effect.
  const adapter = new PrismaBetterSqlite3({ url: `file:${DATABASE_FILE}`, timeout: 5000 })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// better-sqlite3 is synchronous and single-connection: within this one Node process, queries
// are already serialized, so WAL's benefit here is across *processes* (e.g. this app alongside
// `npm run db:backfill`, or a future second app instance), not within one. Under real
// contention, a query that waits longer than the busy timeout above surfaces to the caller as
// a Prisma "database is locked" error rather than hanging forever.
