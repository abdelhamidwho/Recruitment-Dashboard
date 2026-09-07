import { NextResponse } from "next/server";
import { startRun } from "@/lib/apify";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";
import { getSource, resolveRequestedSourceId, APIFY_SOURCE_ID } from "@/lib/sources";
import { recordAppearance } from "@/lib/profileStorage";
import type { SearchFilters } from "@/lib/buildBooleanQuery";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const body = await req.json();

    // Validate the requested source (defaulting to GitHub) up front so an
    // unknown source id gets a clear 400 instead of surfacing as a
    // confusing downstream error.
    let sourceId: string;
    try {
      sourceId = resolveRequestedSourceId(body.source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const filters: Partial<SearchFilters> = { ...body };
    delete (filters as Record<string, unknown>).source;

    if (sourceId !== APIFY_SOURCE_ID) {
      const source = getSource(sourceId);

      // --- Synchronous source path -----------------------------------
      // Unlike Apify's async run/poll/dataset flow, a synchronous source's
      // search() call returns candidates directly during this request. The
      // run is therefore created already SUCCEEDED so the client's first
      // poll to GET /api/search/[searchRunId] returns finished results
      // immediately, without contorting this source into a fake async job
      // or touching the client's poll loop (which Apify still needs).
      const searchRun = await prisma.searchRun.create({
        data: {
          source: sourceId,
          filters: JSON.stringify(filters),
          status: "RUNNING",
          ownerId: user.id,
        },
      });

      try {
        const candidates = await source.search(filters, {
          token: process.env.GITHUB_TOKEN,
        });

        for (const candidate of candidates) {
          if (!candidate.profileUrl) continue;
          await recordAppearance(searchRun.id, candidate, filters, sourceId);
        }

        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: { status: "SUCCEEDED", itemCount: candidates.length },
        });
      } catch (error) {
        // Matches the Apify path: a source failure (e.g. GitHub rate limit)
        // is recorded on the SearchRun row rather than only thrown, so it
        // shows up in search history instead of a bare in-flight error.
        const message = error instanceof Error ? error.message : String(error);
        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: { status: "FAILED", failureReason: message },
        });
        return NextResponse.json(
          { searchRunId: searchRun.id, status: "FAILED", error: message, failureReason: message },
          { status: 502 },
        );
      }

      return NextResponse.json({ searchRunId: searchRun.id, status: "SUCCEEDED" });
    }

    // --- Asynchronous (Apify) source path -------------------------------
    // Left exactly as it behaved before source selection existed: start the
    // run, store the run/dataset id, and let the client poll
    // GET /api/search/[searchRunId] until it reports SUCCEEDED.
    let runId: string;
    let datasetId: string | undefined;
    try {
      ({ runId, datasetId } = await startRun(filters));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedRun = await prisma.searchRun.create({
        data: {
          source: sourceId,
          filters: JSON.stringify(filters),
          status: "FAILED",
          failureReason: message,
          ownerId: user.id,
        },
      });
      return NextResponse.json(
        { searchRunId: failedRun.id, status: "FAILED", error: message, failureReason: message },
        { status: 502 },
      );
    }

    const searchRun = await prisma.searchRun.create({
      data: {
        source: sourceId,
        runId,
        datasetId,
        filters: JSON.stringify(filters),
        status: "RUNNING",
        ownerId: user.id,
      },
    });

    return NextResponse.json({ runId, searchRunId: searchRun.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
