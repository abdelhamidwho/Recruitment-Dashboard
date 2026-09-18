import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/requireUser";
import { getCollaborationState } from "@/lib/collaboration";

/**
 * Batch collaboration state for a list of people (favourited-by-me,
 * watchlists, viewers, per-job stage). Body: { personIds: string[] }.
 * Backs the results table — implemented as four fixed queries regardless of
 * list size, never one query per candidate.
 */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await req.json();
  const personIds = Array.isArray(body.personIds) ? body.personIds.map(String) : [];

  const state = await getCollaborationState(personIds, user.id);
  return NextResponse.json({ state });
}
