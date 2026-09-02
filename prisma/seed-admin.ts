// `npm run seed:admin` invokes this file directly via `tsx`, which — unlike
// `next dev`/`next build` — does not load `.env` on its own. `prisma.config.ts`
// already relies on the same `dotenv/config` side-effect import for the same
// reason, so this mirrors that existing convention rather than introducing a
// new one.
import 'dotenv/config'
import { hashPassword } from '../src/lib/auth/password'
import { prisma } from '../src/lib/prisma'

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set')
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`admin ${email} already exists, nothing to do`)
    return
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  })

  console.log(`created admin ${email} — you will be asked to change this password on first login`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
