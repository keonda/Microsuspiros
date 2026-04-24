import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use the Writer Studio login form." }, { status: 405 });
}
