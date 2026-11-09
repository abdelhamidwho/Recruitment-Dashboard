import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

/**
 * Database-backed tests run against a real PostgreSQL database, given by
 * TEST_DATABASE_URL (a throwaway/dev database — never production). When it is
 * unset those tests are skipped. Each test file gets its own schema, built from
 * the real migrations in prisma/migrations, and dropped again afterwards.
 */
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

export async function createTestDb(): Promise<{
  prisma: PrismaClient
  cleanup: () => Promise<void>
}> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL is not set')

  const schema = `test_${randomBytes(6).toString('hex')}`
  const admin = new Pool({ connectionString: url, max: 1 })
  await admin.query(`CREATE SCHEMA "${schema}"`)

  const root = join(process.cwd(), 'prisma', 'migrations')
  const dirs = readdirSync(root)
    .filter((name) => name !== 'migration_lock.toml')
    .sort()
  const client = await admin.connect()
  try {
    await client.query(`SET search_path TO "${schema}"`)
    for (const dir of dirs) {
      // The baseline begins with CREATE SCHEMA "public"; harmless but unneeded here.
      await client.query(readFileSync(join(root, dir, 'migration.sql'), 'utf8'))
    }
  } finally {
    client.release()
  }

  const adapter = new PrismaPg({ connectionString: url }, { schema })
  const prisma = new PrismaClient({ adapter })
  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect()
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
      await admin.end()
    },
  }
}
