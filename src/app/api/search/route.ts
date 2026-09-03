import { NextResponse } from "next/server";
import { startRun } from "@/lib/apify";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

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
      },
    });

    return NextResponse.json({ runId, searchRunId: searchRun.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
