import { prisma } from '../src/lib/prisma'
import { normalizeEducation } from '../src/lib/normalize/education'
import { totalYearsOfExperience } from '../src/lib/normalize/experience'
import { normalizeIndustry } from '../src/lib/normalize/industry'
import { normalizeLanguages } from '../src/lib/normalize/languages'
import { normalizeLocation } from '../src/lib/normalize/location'

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function main() {
  const people = await prisma.person.findMany()
  let updated = 0
  let failed = 0
  const failures: { id: string; fullName: string; error: string }[] = []

  for (const person of people) {
    try {
      const raw = parse<Record<string, unknown>>(person.raw, {})
      const location = normalizeLocation(person.locationRaw)
      const education = normalizeEducation(parse(person.education, []))
      const languages = normalizeLanguages(parse(person.languages, []))
      const years = totalYearsOfExperience(parse(person.experience, []))
      const industry = normalizeIndustry(
        typeof raw.industry === 'string' ? raw.industry : null,
        person.currentCompany,
      )

      await prisma.person.update({
        where: { id: person.id },
        data: {
          city: location.city,
          country: location.country,
          region: location.region,
          highestDegree: education.highestDegree,
          fieldsOfStudy: JSON.stringify(education.fieldsOfStudy),
          languages: JSON.stringify(languages),
          industry,
          totalYearsExperience: years ?? person.totalYearsExperience,
        },
      })
      updated += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ id: person.id, fullName: person.fullName, error: message })
      console.error(`failed to normalise person ${person.id} (${person.fullName}): ${message}`)
    }
  }

  console.log(
    `examined ${people.length} people, updated ${updated}, failed ${failed}`,
  )

  if (failed > 0) {
    console.error(
      `${failed} people failed normalisation: ${failures.map((f) => `${f.fullName} (${f.id})`).join(', ')}`,
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
