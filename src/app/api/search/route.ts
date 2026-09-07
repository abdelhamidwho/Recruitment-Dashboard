import { NextResponse } from "next/server";
import { startRun } from "@/lib/apify";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const filters = await req.json();

    // Start Apify run
    let runId: string;
    let datasetId: string | undefined;
    try {
      ({ runId, datasetId } = await startRun(filters));
    } catch (error) {
      // Record the failure on a SearchRun row (rather than only throwing)
      // so it shows up in search history and the UI, not just a bare
      // in-flight error — this is what makes a missing-credentials or
      // unverified-actor-input failure visible instead of cryptic.
      const message = error instanceof Error ? error.message : String(error);
      const failedRun = await prisma.searchRun.create({
        data: {
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

    // Create SearchRun record
    const searchRun = await prisma.searchRun.create({
      data: {
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
