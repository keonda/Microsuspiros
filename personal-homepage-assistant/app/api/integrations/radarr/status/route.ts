import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOverview } from "@/lib/integrations";

export async function GET() {
  await requireUser();
  const summary = await getOverview("radarr", true);
  return NextResponse.json({ status: summary.status, error: summary.error, lastUpdated: summary.lastUpdated });
}
