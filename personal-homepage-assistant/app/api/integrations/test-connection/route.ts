import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { testIntegration } from "@/lib/integrations";

export async function POST(request: NextRequest) {
  await requireUser();
  const { kind } = z.object({ kind: z.enum(["plex", "sonarr", "radarr"]) }).parse(await request.json());
  return NextResponse.json(await testIntegration(kind));
}
