import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, adminPassword, adminSessionToken, adminUsername, isAuthConfigured, secureAdminCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (username !== adminUsername() || password !== adminPassword()) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(AUTH_COOKIE, await adminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureAdminCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}
