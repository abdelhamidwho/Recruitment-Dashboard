import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { recordView, getViewers, CollaborationError } from "@/lib/collaboration";

/** Records that the caller viewed this person (first-view-auto-records; see recordView). */
export async function POST(_req: Request, { params }: { params: Promise<{ personId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { personId } = await params;

  try {
    const view = await recordView(personId, user.id);
    return NextResponse.json({ view });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Who has viewed this person, and when. */
export async function GET(_req: Request, { params }: { params: Promise<{ personId: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { personId } = await params;
  const viewers = await getViewers(personId);
  return NextResponse.json({ viewers });
}
