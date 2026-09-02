import { NextResponse } from "next/server";
import skills from "@/data/skills.json";
import rolePresets from "@/data/rolePresets.json";

export async function GET() {
  return NextResponse.json({
    skills,
    presets: rolePresets,
  });
}
