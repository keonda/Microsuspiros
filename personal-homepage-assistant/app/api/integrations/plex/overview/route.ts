import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOverview } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  await requireUser();
  return NextResponse.json(await getOverview("plex", request.nextUrl.searchParams.get("refresh") === "1"));
}
