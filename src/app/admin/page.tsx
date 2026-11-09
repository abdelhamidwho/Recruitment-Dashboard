import Link from 'next/link'
import { Briefcase, Search, UserCheck, Users, Heart, Eye, UserPlus, ArrowRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/requireUser'
import { STAGES } from '@/lib/auth/constants'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/PageHeader'

const DAY = 24 * 60 * 60 * 1000

function Tile({ Icon, label, value, hint }: { Icon: React.ElementType; label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--brand-tint)]">
        <Icon aria-hidden className="size-8 text-[var(--brand-deep)]" />
      </span>
      <div>
        <div className="text-3xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-base font-medium">{label}</div>
        {hint ? <div className="text-sm text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  )
}

export default async function AdminOverview() {
  await requireAdmin()
  const weekAgo = new Date(Date.now() - 7 * DAY)

  const [
    users,
    activeUsers,
    openJobs,
    searchesWeek,
    candidatesInPipeline,
    stageGroups,
    watchlists,
    favorites,
    recentEvents,
    recruiters,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.job.count({ where: { isArchived: false } }),
    prisma.searchRun.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.jobCandidate.count(),
    prisma.jobCandidate.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.watchlist.count(),
    prisma.favorite.count(),
    prisma.stageEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true, jobCandidate: { include: { person: true, job: true } } },
    }),
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { searchRuns: true, jobsCreated: true, favorites: true, stageEvents: true } },
      },
    }),
  ])

  const byStage = Object.fromEntries(stageGroups.map((g) => [g.stage, g._count._all]))
  const max = Math.max(1, ...STAGES.map((s) => byStage[s] ?? 0))
  const hired = byStage['Hired'] ?? 0

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Admin overview"
        subtitle="A quick look at how the team is using the dashboard."
      >
        <Link
          href="/admin/users"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--brand-deep)] px-5 text-lg font-semibold text-white hover:bg-[var(--brand)]"
        >
          <UserPlus aria-hidden className="size-6" />
          Manage team accounts
        </Link>
      </PageHeader>

      <div className="mx-auto max-w-[96rem] space-y-6 p-6 !animate-none">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tile Icon={Users} label="Team members" value={activeUsers} hint={`${users} accounts in total`} />
          <Tile Icon={Search} label="Searches this week" value={searchesWeek} />
          <Tile Icon={Briefcase} label="Open jobs" value={openJobs} />
          <Tile Icon={UserCheck} label="Candidates in jobs" value={candidatesInPipeline} hint={`${hired} hired`} />
          <Tile Icon={Eye} label="Watchlists" value={watchlists} />
          <Tile Icon={Heart} label="Favourites saved" value={favorites} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Hiring progress</h2>
            <ul className="space-y-3">
              {STAGES.map((stage) => {
                const n = byStage[stage] ?? 0
                return (
                  <li key={stage} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-base font-medium">{stage}</span>
                    <span className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(n / max) * 100}%`,
                          background: stage === 'Rejected' ? 'var(--grey)' : 'var(--brand)',
                        }}
                      />
                    </span>
                    <span className="w-8 text-right text-lg font-bold tabular-nums">{n}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Latest moves</h2>
            {recentEvents.length === 0 ? (
              <p className="text-base text-muted-foreground">Nothing yet. Moves appear here when someone changes a candidate’s stage.</p>
            ) : (
              <ul className="divide-y">
                {recentEvents.map((e) => (
                  <li key={e.id} className="py-2.5 text-base">
                    <span className="font-semibold">{e.user.name}</span> moved{' '}
                    <span className="font-semibold">{e.jobCandidate.person.fullName || 'a candidate'}</span>{' '}
                    {e.fromStage ? <>from {e.fromStage} </> : null}to{' '}
                    <span className="font-semibold text-[var(--brand-deep)]">{e.toStage}</span> for{' '}
                    {e.jobCandidate.job.title}
                    <span className="block text-sm text-muted-foreground">{e.createdAt.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Team activity</h2>
            <Link href="/admin/users" className="lux-nav-link">
              Manage accounts <ArrowRight aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Person</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Searches</th>
                  <th className="py-2 text-right">Jobs created</th>
                  <th className="py-2 text-right">Favourites</th>
                  <th className="py-2 text-right">Stage moves</th>
                </tr>
              </thead>
              <tbody>
                {recruiters.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-3">
                      <span className="font-semibold">{u.name}</span>
                      <span className="block text-sm text-muted-foreground">{u.email}</span>
                    </td>
                    <td className="py-3">{u.isActive ? 'Active' : 'Disabled'}</td>
                    <td className="py-3 text-right tabular-nums">{u._count.searchRuns}</td>
                    <td className="py-3 text-right tabular-nums">{u._count.jobsCreated}</td>
                    <td className="py-3 text-right tabular-nums">{u._count.favorites}</td>
                    <td className="py-3 text-right tabular-nums">{u._count.stageEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
