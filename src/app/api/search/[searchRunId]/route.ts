import { NextResponse } from "next/server";
import { fetchDatasetItems, getRunDetails, startRun } from "@/lib/apify";
import { requireApiUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { GATED_SCORE_SENTINEL } from "@/lib/scoring";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { isSearchRunTimedOut, searchRunTimeoutReason } from "@/lib/searchRunTimeout";
import { recordAppearance } from "@/lib/profileStorage";

export async function GET(_req: Request, { params }: { params: Promise<{ searchRunId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchRunId } = await params;

  try {
    const searchRun = await prisma.searchRun.findUnique({ where: { id: searchRunId } });
    if (!searchRun) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    let status = searchRun.status;
    let statusMessage: string | undefined;
    let actorIndex = 0;
    let hasNext = false;
    if (searchRun.runId) {
      try {
        ({ status, statusMessage, actorIndex, hasNext } = await getRunDetails(searchRun.runId));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: { status: "FAILED", failureReason: message },
        });
        return NextResponse.json({ status: "FAILED", error: message, failureReason: message }, { status: 502 });
      }
    }

    // A run stuck at RUNNING/READY past a sensible threshold is recorded as
    // TIMED-OUT rather than polled forever (see src/lib/searchRunTimeout.ts).
    if (isSearchRunTimedOut(status, searchRun.createdAt)) {
      const failureReason = searchRunTimeoutReason(searchRun.createdAt);
      await prisma.searchRun.update({
        where: { id: searchRun.id },
        data: { status: "TIMED-OUT", failureReason },
      });
      return NextResponse.json({ status: "TIMED-OUT", failureReason, itemCount: 0, candidates: [] });
    }

    if (status !== searchRun.status) {
      await prisma.searchRun.update({ where: { id: searchRun.id }, data: { status } });
    }

    if (status === "SUCCEEDED" && searchRun.datasetId && searchRun.itemCount === 0) {
      const filters = JSON.parse(searchRun.filters) as Partial<SearchFilters>;
      const scraped = await fetchDatasetItems(searchRun.datasetId, filters.limit ?? 50, actorIndex);

      for (const candidate of scraped) {
        if (!candidate.profileUrl) continue;
        await recordAppearance(searchRun.id, candidate, filters, searchRun.source ?? undefined);
      }

      // An empty result with a status message from the actor is a refusal
      // (quota, plan limit, bad input), not "no matches" — report it as one.
      if (scraped.length === 0 && statusMessage && /limit|quota|upgrade|credit|fail|error|invalid/i.test(statusMessage)) {
        // Another configured actor can take over (e.g. this one hit a free-plan
        // run cap): start it on the same search and keep the client polling.
        if (hasNext) {
          try {
            const next = await startRun(filters, actorIndex + 1);
            await prisma.searchRun.update({
              where: { id: searchRun.id },
              data: { runId: next.runId, datasetId: next.datasetId, status: "RUNNING", failureReason: null, itemCount: 0 },
            });
            return NextResponse.json({ status: "RUNNING" });
          } catch {
            // fall through and report the original actor's refusal
          }
        }
        const failureReason = `Apify actor returned nothing: ${statusMessage}`;
        await prisma.searchRun.update({ where: { id: searchRun.id }, data: { status: "FAILED", failureReason } });
        return NextResponse.json({ status: "FAILED", failureReason, itemCount: 0, candidates: [] });
      }

      await prisma.searchRun.update({
        where: { id: searchRun.id },
        data: { itemCount: scraped.length },
      });
    }

    const appearances = await prisma.searchRunPerson.findMany({
      where: { searchRunId: searchRun.id },
      include: { person: true },
      orderBy: { score: "desc" },
    });

    // A candidate that failed a hard gate (missing must-have skill, or an
    // excluded-keyword hit — see src/lib/scoring/gates.ts) is persisted
    // with GATED_SCORE_SENTINEL instead of a real score, so it can be
    // upserted once and never re-fetched, but it must not appear in the
    // ranked list. Gating is reported via `excludedCount`/`excludedSample`
    // below rather than silently shrinking the result count with no
    // explanation.
    const ranked = appearances.filter((a) => a.score !== GATED_SCORE_SENTINEL);
    const excluded = appearances.filter((a) => a.score === GATED_SCORE_SENTINEL);

    // Kept flat and named as the current UI expects; Phase 2 replaces this shape.
    const candidates = ranked.map(({ person, score, scoreBreakdown, wasKnownBefore }) => ({
      id: person.id,
      externalId: person.externalId,
      source: person.source,
      fullName: person.fullName,
      headline: person.headline,
      currentTitle: person.currentTitle,
      currentCompany: person.currentCompany,
      location: person.locationRaw,
      city: person.city,
      country: person.country,
      region: person.region,
      industry: person.industry,
      highestDegree: person.highestDegree,
      fieldsOfStudy: person.fieldsOfStudy,
      profileUrl: person.profileUrl,
      avatarUrl: person.avatarUrl,
      summary: person.summary,
      skills: person.skills,
      experience: person.experience,
      education: person.education,
      languages: person.languages,
      certifications: person.certifications,
      totalYearsExperience: person.totalYearsExperience,
      score,
      scoreBreakdown,
      wasKnownBefore,
    }));

    return NextResponse.json({
      status,
      itemCount: candidates.length,
      candidates,
      // Additive fields — how many candidates a hard gate removed from this
      // run, and a small sample of why, so exclusion is visible in the UI
      // instead of just a smaller-than-expected result count.
      excludedCount: excluded.length,
      excludedSample: excluded.slice(0, 5).map((a) => ({
        fullName: a.person.fullName,
        reasons: a.scoreBreakdown ? (JSON.parse(a.scoreBreakdown) as string[]) : [],
      })),
      failureReason: searchRun.failureReason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
