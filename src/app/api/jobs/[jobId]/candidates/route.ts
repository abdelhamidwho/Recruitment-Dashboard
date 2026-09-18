import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { addCandidateToJob, CollaborationError } from "@/lib/collaboration";

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { jobId } = await params;

  try {
    const body = await req.json();
    const personId = String(body.personId ?? "");
    if (!personId) return NextResponse.json({ error: "personId is required" }, { status: 400 });

    const candidate = await addCandidateToJob(jobId, personId, user.id);
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
