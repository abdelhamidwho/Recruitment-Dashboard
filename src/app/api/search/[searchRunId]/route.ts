import { NextResponse } from "next/server";
import { fetchDatasetItems, getRunStatus } from "@/lib/apify";
import { requireApiUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { scoreCandidate } from "@/lib/scoring";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { isSearchRunTimedOut, searchRunTimeoutReason } from "@/lib/searchRunTimeout";
import { upsertPerson } from "@/lib/profileStorage";

export async function GET(_req: Request, { params }: { params: Promise<{ searchRunId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchRunId } = await params;

  try {
    const searchRun = await prisma.searchRun.findUnique({ where: { id: searchRunId } });
    if (!searchRun) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    let status = searchRun.status;
    if (searchRun.runId) {
      try {
        status = await getRunStatus(searchRun.runId);
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
      const scraped = await fetchDatasetItems(searchRun.datasetId, filters.limit ?? 50);

      for (const candidate of scraped) {
        if (!candidate.profileUrl) continue;
        const { person, wasKnownBefore } = await upsertPerson(candidate, searchRun.source ?? undefined);
        const { score, breakdown } = scoreCandidate(candidate, filters);

        await prisma.searchRunPerson.upsert({
          where: { searchRunId_personId: { searchRunId: searchRun.id, personId: person.id } },
          create: {
            searchRunId: searchRun.id,
            personId: person.id,
            score,
            scoreBreakdown: JSON.stringify(breakdown),
            wasKnownBefore,
          },
          update: { score, scoreBreakdown: JSON.stringify(breakdown) },
        });
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

    // Kept flat and named as the current UI expects; Phase 2 replaces this shape.
    const candidates = appearances.map(({ person, score, scoreBreakdown, wasKnownBefore }) => ({
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
      failureReason: searchRun.failureReason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
