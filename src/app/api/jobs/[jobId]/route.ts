import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { getPipeline, CollaborationError } from "@/lib/collaboration";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { jobId } = await params;

  try {
    const { job, byStage } = await getPipeline(jobId);
    return NextResponse.json({ job, byStage });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
