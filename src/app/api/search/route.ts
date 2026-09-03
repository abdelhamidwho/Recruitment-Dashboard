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
    const { runId, datasetId } = await startRun(filters);

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
