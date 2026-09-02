import { prisma } from '../src/lib/prisma'
import { runBackfill } from './backfill-normalize-lib'

async function main() {
  const result = await runBackfill(prisma)

  console.log(`examined ${result.examined} people, updated ${result.updated}, failed ${result.failed}`)

  if (result.failed > 0) {
    console.error(
      `${result.failed} people failed normalisation: ${result.failures
        .map((f) => `${f.fullName} (${f.id})`)
        .join(', ')}`,
    )
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
