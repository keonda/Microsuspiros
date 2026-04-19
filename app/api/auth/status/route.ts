import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, adminPassword, adminSessionToken, adminUsername, hashText, isAuthConfigured, secureAdminCookie } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE)?.value;
  const username = adminUsername();
  const password = adminPassword();

  return NextResponse.json({
    authConfigured: isAuthConfigured(),
    usernameConfigured: Boolean(adminUsername()),
    passwordConfigured: Boolean(adminPassword()),
    sessionSecretConfigured: Boolean(process.env.ADMIN_SESSION_SECRET),
    expectedUsername: username,
    expectedUsernameLength: username.length,
    expectedPasswordLength: password.length,
    expectedPasswordHash8: password ? (await hashText(password)).slice(0, 8) : null,
    cookiePresent: Boolean(cookie),
    cookieValid: cookie === (await adminSessionToken()),
    cookieSecure: secureAdminCookie()
  });
}
