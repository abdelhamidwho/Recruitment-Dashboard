import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Point it at a PostgreSQL database, e.g. ' +
      'postgresql://user:password@host/dbname?sslmode=require',
  )
}

function createClient() {
  // `max` keeps each serverless instance to a small pool so many concurrent
  // instances (Vercel) do not exhaust the database's connection limit.
  const adapter = new PrismaPg({ connectionString, max: 5 })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
