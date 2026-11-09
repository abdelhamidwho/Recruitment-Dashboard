import { NextResponse } from "next/server";
import { DEEP_SCAN_MAX, startDeepScan } from "@/lib/apify";
import { requireApiUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { GATED_SCORE_SENTINEL } from "@/lib/scoring";

/**
 * Starts a deep scan: sends the best-scoring LinkedIn profiles of a search
 * run, that still lack work history, to Apify for full profile details. The
 * client then polls GET /api/deep-scan/[runId]?searchRunId=... to finish it.
 */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const searchRunId = typeof body?.searchRunId === "string" ? body.searchRunId : "";
    const count = Math.min(Math.max(Number(body?.count) || DEEP_SCAN_MAX, 1), DEEP_SCAN_MAX);
    if (!searchRunId) return NextResponse.json({ error: "searchRunId is required" }, { status: 400 });

    const appearances = await prisma.searchRunPerson.findMany({
      where: { searchRunId },
      include: { person: true },
      orderBy: { score: "desc" },
    });

    const targets = appearances
      .filter((a) => a.score !== GATED_SCORE_SENTINEL)
      .filter((a) => /linkedin\.com\/in\//i.test(a.person.profileUrl))
      // Already has work history: a deep scan would only cost money.
      .filter((a) => !a.person.experience || a.person.experience === "[]")
      .slice(0, count);

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Nothing to scan: the top LinkedIn candidates in this search already have full details." },
        { status: 400 },
      );
    }

    const urls = targets.map((t) => t.person.profileUrl);
    const run = await startDeepScan(urls);
    return NextResponse.json({ runId: run.runId, datasetId: run.datasetId, count: run.count, urls });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
