import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { toggleFavorite, CollaborationError } from "@/lib/collaboration";

/** Toggles a favourite for the caller (never another user — the actor is always the session user). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { personId } = await params;

  try {
    const result = await toggleFavorite(user.id, personId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
