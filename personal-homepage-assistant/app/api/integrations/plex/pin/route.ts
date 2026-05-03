import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPlexPin } from "@/lib/integrations";

export async function POST() {
  await requireUser();
  return NextResponse.json(await createPlexPin());
}
