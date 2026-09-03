import { NextResponse } from "next/server";
import skills from "@/data/skills.json";
import rolePresets from "@/data/rolePresets.json";
import { requireApiUser } from "@/lib/auth/requireUser";

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    skills,
    presets: rolePresets,
  });
}
