import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, adminPassword, adminSessionToken, adminUsername, isAuthConfigured, secureAdminCookie } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE)?.value;

  return NextResponse.json({
    authConfigured: isAuthConfigured(),
    usernameConfigured: Boolean(adminUsername()),
    passwordConfigured: Boolean(adminPassword()),
    sessionSecretConfigured: Boolean(process.env.ADMIN_SESSION_SECRET),
    cookiePresent: Boolean(cookie),
    cookieValid: cookie === (await adminSessionToken()),
    cookieSecure: secureAdminCookie()
  });
}
