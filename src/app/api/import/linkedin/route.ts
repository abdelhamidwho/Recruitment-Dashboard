import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";
import { recordAppearance } from "@/lib/profileStorage";
import { LINKEDIN_SOURCE_ID, parseLinkedInImport } from "@/lib/linkedinImport";

/**
 * Imports LinkedIn profiles captured outside the app (bookmarklet / X-ray
 * script output). Body: `{ profiles: Profile | Profile[], filters?: {...} }`.
 * Creates an already-SUCCEEDED SearchRun so the people show up through the
 * normal results endpoint, scored against `filters` when supplied.
 */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: { profiles?: unknown; filters?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { candidates, errors } = parseLinkedInImport(body.profiles);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No valid profiles to import.", errors }, { status: 400 });
  }

  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const run = await prisma.searchRun.create({
    data: {
      source: LINKEDIN_SOURCE_ID,
      filters: JSON.stringify(filters),
      status: "RUNNING",
      ownerId: auth.id,
    },
  });

  let newCount = 0;
  for (const candidate of candidates) {
    const r = await recordAppearance(run.id, candidate, filters, LINKEDIN_SOURCE_ID);
    if (!r.wasKnownBefore) newCount++;
  }
  await prisma.searchRun.update({
    where: { id: run.id },
    data: { status: "SUCCEEDED", itemCount: candidates.length },
  });

  return NextResponse.json({
    searchRunId: run.id,
    imported: candidates.length,
    newPeople: newCount,
    errors,
  });
}
