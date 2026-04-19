import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { publicUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  const response = NextResponse.redirect(publicUrl(request, "/login"), 303);
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
