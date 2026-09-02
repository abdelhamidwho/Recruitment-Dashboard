import { NextResponse } from "next/server";
import { getRunStatus, fetchDatasetItems } from "@/lib/apify";
import { prisma } from "@/lib/prisma";
import { scoreCandidate } from "@/lib/scoring";
import { SearchFilters } from "@/lib/buildBooleanQuery";

export async function GET(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  
  try {
    const searchRun = await prisma.searchRun.findFirst({
      where: { runId },
    });

    if (!searchRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const status = await getRunStatus(runId);
    
    if (status !== searchRun.status) {
      await prisma.searchRun.update({
        where: { id: searchRun.id },
        data: { status },
      });
    }

    if (status === "SUCCEEDED" && searchRun.datasetId && searchRun.itemCount === 0) {
      // Fetch and process candidates if we haven't yet
      const filters = JSON.parse(searchRun.filters) as Partial<SearchFilters>;
      const rawCandidates = await fetchDatasetItems(searchRun.datasetId);
      
      const candidatesToCreate = rawCandidates.map((c) => {
        const { score, breakdown } = scoreCandidate(c, filters);
        return {
          externalId: c.externalId,
          fullName: c.fullName,
          headline: c.headline,
          currentTitle: c.currentTitle,
          currentCompany: c.currentCompany,
          location: c.location,
          profileUrl: c.profileUrl,
          avatarUrl: c.avatarUrl,
          summary: c.summary,
          skills: JSON.stringify(c.skills),
          experience: JSON.stringify(c.experience),
          education: JSON.stringify(c.education),
          languages: JSON.stringify(c.languages || []),
          certifications: JSON.stringify(c.certifications || []),
          totalYearsExperience: c.totalYearsExperience,
          raw: JSON.stringify(c.raw),
          score,
          scoreBreakdown: JSON.stringify(breakdown),
          searchRunId: searchRun.id,
        };
      });

      // Simple deduplication (ignoring existing in DB for this demo scale, just inserting)
      if (candidatesToCreate.length > 0) {
        await prisma.candidate.createMany({
          data: candidatesToCreate,
        });
      }

      await prisma.searchRun.update({
        where: { id: searchRun.id },
        data: { itemCount: candidatesToCreate.length },
      });
    }

    const candidates = await prisma.candidate.findMany({
      where: { searchRunId: searchRun.id },
      orderBy: { score: 'desc' },
    });

    return NextResponse.json({
      status,
      itemCount: candidates.length,
      candidates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
