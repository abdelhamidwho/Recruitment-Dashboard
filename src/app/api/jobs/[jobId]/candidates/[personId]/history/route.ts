import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { getStageHistory, CollaborationError } from "@/lib/collaboration";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string; personId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { jobId, personId } = await params;

  try {
    const events = await getStageHistory(jobId, personId);
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
