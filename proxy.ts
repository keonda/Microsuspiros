import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

function authConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

export function proxy(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const isAuthed = request.cookies.get(AUTH_COOKIE)?.value === process.env.ADMIN_SESSION_SECRET;

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
