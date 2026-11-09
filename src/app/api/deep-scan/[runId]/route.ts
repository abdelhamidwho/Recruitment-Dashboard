import { NextResponse } from "next/server";
import { fetchDeepScanItems, getDeepScanRun } from "@/lib/apify";
import { requireApiUser } from "@/lib/auth/requireUser";
import { canonicalLinkedInUrl } from "@/lib/linkedinImport";
import { prisma } from "@/lib/prisma";
import { recordAppearance } from "@/lib/profileStorage";
import type { SearchFilters } from "@/lib/buildBooleanQuery";

/**
 * Polls a deep scan. Once Apify reports SUCCEEDED, the fuller profiles are
 * stored on the same people and re-scored against the original search, so the
 * client only has to reload the run's results.
 *
 * Query: searchRunId (the search the scan belongs to), urls (comma-separated
 * profile URLs that were sent).
 */
export async function GET(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const { runId } = await params;
    const url = new URL(req.url);
    const searchRunId = url.searchParams.get("searchRunId") ?? "";
    const urls = (url.searchParams.get("urls") ?? "").split(",").filter(Boolean);

    const searchRun = await prisma.searchRun.findUnique({ where: { id: searchRunId } });
    if (!searchRun) return NextResponse.json({ error: "Search run not found" }, { status: 404 });

    const { status, statusMessage } = await getDeepScanRun(runId);
    if (status !== "SUCCEEDED") {
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
        return NextResponse.json({ status, failureReason: statusMessage ?? `Deep scan ${status}` });
      }
      return NextResponse.json({ status });
    }

    const datasetId = new URL(req.url).searchParams.get("datasetId") ?? "";
    const candidates = await fetchDeepScanItems(datasetId, urls, canonicalLinkedInUrl as (u: string) => string | null);
    if (candidates.length === 0) {
      return NextResponse.json({
        status: "FAILED",
        failureReason: statusMessage
          ? `Deep scan returned nothing: ${statusMessage}`
          : "Deep scan returned no profiles (they may be private or unavailable).",
      });
    }

    const filters = JSON.parse(searchRun.filters) as Partial<SearchFilters>;
    for (const candidate of candidates) {
      // Scored as "apify": the data is now full, so skills/experience count.
      await recordAppearance(searchRun.id, candidate, filters, "apify");
    }
    return NextResponse.json({ status: "SUCCEEDED", scanned: candidates.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "FAILED", failureReason: message, error: message }, { status: 502 });
  }
}
