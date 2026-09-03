import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const searchRun = await prisma.searchRun.findFirst({
    where: { runId },
    include: { candidates: true }
  });

  if (!searchRun) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  let csv = "Name,Headline,Company,Title,Location,Profile URL,Score\n";
  for (const c of searchRun.candidates) {
    const row = [
      c.fullName,
      c.headline || "",
      c.currentCompany || "",
      c.currentTitle || "",
      c.location || "",
      c.profileUrl,
      c.score || 0
    ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(",");
    csv += row + "\n";
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="candidates-${runId}.csv"`
    }
  });
}
