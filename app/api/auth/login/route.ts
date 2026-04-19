import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, adminPassword, adminSessionToken, adminUsername, isAuthConfigured, secureAdminCookie } from "@/lib/auth";
import { publicUrl } from "@/lib/request-url";

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.redirect(publicUrl(request, "/"), 303);
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (username !== adminUsername() || password !== adminPassword()) {
    return NextResponse.redirect(publicUrl(request, "/login?error=1"), 303);
  }

  const response = NextResponse.redirect(publicUrl(request, "/"), 303);
  response.cookies.set(AUTH_COOKIE, await adminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureAdminCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}
