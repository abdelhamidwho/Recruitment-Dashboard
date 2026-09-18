import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { removeFromWatchlist, CollaborationError } from "@/lib/collaboration";

/** Removes a person from a watchlist. Owner only. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ watchlistId: string; personId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { watchlistId, personId } = await params;

  try {
    const result = await removeFromWatchlist(watchlistId, personId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
