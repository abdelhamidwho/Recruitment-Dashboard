import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const DATABASE_FILE = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './dev.db'

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: `file:${DATABASE_FILE}` })
  const client = new PrismaClient({ adapter })
  // WAL lets readers and a writer work concurrently, which a shared HR server needs.
  client.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {})
  client.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
  return client
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
