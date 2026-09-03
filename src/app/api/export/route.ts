import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const searchRunId = new URL(req.url).searchParams.get("searchRunId");
  if (!searchRunId) {
    return NextResponse.json({ error: "searchRunId required" }, { status: 400 });
  }

  const appearances = await prisma.searchRunPerson.findMany({
    where: { searchRunId },
    include: { person: true },
    orderBy: { score: "desc" },
  });

  if (appearances.length === 0) {
    return NextResponse.json({ error: "Run not found or empty" }, { status: 404 });
  }

  const header = "Name,Headline,Company,Title,City,Country,Region,Industry,Degree,Years,Profile URL,Score";
  const rows = appearances.map(({ person, score }) =>
    [
      person.fullName,
      person.headline ?? "",
      person.currentCompany ?? "",
      person.currentTitle ?? "",
      person.city ?? "",
      person.country ?? "",
      person.region ?? "",
      person.industry ?? "",
      person.highestDegree ?? "",
      person.totalYearsExperience ?? "",
      person.profileUrl,
      score ?? 0,
    ]
      .map((field) => `"${String(field).replace(/"/g, '""')}"`)
      .join(","),
  );

  return new NextResponse([header, ...rows].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="candidates-${searchRunId}.csv"`,
    },
  });
}
