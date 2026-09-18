import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { listFavorites } from "@/lib/collaboration";

/** The caller's own favourites. Never another user's — userId always comes from the session. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const favorites = await listFavorites(user.id);
  return NextResponse.json({ favorites });
}
