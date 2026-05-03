import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkPlexPin } from "@/lib/integrations";

export async function POST(request: NextRequest) {
  await requireUser();
  const { pinId } = z.object({ pinId: z.number() }).parse(await request.json());
  return NextResponse.json(await checkPlexPin(pinId));
}
