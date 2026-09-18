import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { createWatchlist, listWatchlistsFor, CollaborationError } from "@/lib/collaboration";

/** Watchlists the caller can see: their own (private or shared) plus other users' shared ones. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const watchlists = await listWatchlistsFor(user.id);
  return NextResponse.json({ watchlists });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const body = await req.json();
    const watchlist = await createWatchlist(user.id, String(body.name ?? ""), Boolean(body.isShared));
    return NextResponse.json({ watchlist }, { status: 201 });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
