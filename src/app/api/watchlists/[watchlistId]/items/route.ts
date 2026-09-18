import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { addToWatchlist, CollaborationError } from "@/lib/collaboration";

/** Adds a person to a watchlist. Idempotent. Body: { personId: string }. Owner only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ watchlistId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { watchlistId } = await params;

  try {
    const body = await req.json();
    const personId = String(body.personId ?? "");
    if (!personId) return NextResponse.json({ error: "personId is required" }, { status: 400 });

    const item = await addToWatchlist(watchlistId, personId, user.id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
