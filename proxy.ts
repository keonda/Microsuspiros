import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, adminPassword, adminSessionToken, adminUsername, isAuthConfigured } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/api/auth/status") {
    return NextResponse.next();
  }

  const isLogin = pathname === "/login";
  const isAuthed = request.cookies.get(AUTH_COOKIE)?.value === (await adminSessionToken());

  if (!adminUsername() || !adminPassword()) {
    return NextResponse.next();
  }

  if (isLogin && isAuthed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isLogin && !isAuthed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
