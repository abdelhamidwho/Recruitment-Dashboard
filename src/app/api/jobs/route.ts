import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { createJob, listJobs, CollaborationError } from "@/lib/collaboration";

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const body = await req.json();
    const job = await createJob(user.id, {
      title: body.title,
      location: body.location,
      description: body.description,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
