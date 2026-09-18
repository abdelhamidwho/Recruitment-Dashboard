import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { changeStage, CollaborationError } from "@/lib/collaboration";

/** Changes a candidate's stage on this job. Body: { stage: string } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ jobId: string; personId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { jobId, personId } = await params;

  try {
    const body = await req.json();
    const candidate = await changeStage(jobId, personId, String(body.stage ?? ""), user.id);
    return NextResponse.json({ candidate });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
