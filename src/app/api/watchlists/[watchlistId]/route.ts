import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { getWatchlist, setWatchlistSharing, CollaborationError } from "@/lib/collaboration";

/** A watchlist's items — 404s (not 403) for a private list the caller doesn't own, so its existence is never revealed. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ watchlistId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { watchlistId } = await params;

  try {
    const result = await getWatchlist(watchlistId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Toggle sharing. Body: { isShared: boolean }. Owner only. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ watchlistId: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { watchlistId } = await params;

  try {
    const body = await req.json();
    const watchlist = await setWatchlistSharing(watchlistId, user.id, Boolean(body.isShared));
    return NextResponse.json({ watchlist });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
