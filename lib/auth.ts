export const AUTH_COOKIE = "microsuspiros_admin";

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export async function adminSessionToken() {
  const input = `microsuspiros-admin:${adminSessionSecret()}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isAuthConfigured() {
  return Boolean(adminUsername() && adminPassword() && adminSessionSecret());
}

export function adminUsername() {
  return cleanEnv(process.env.ADMIN_USERNAME);
}

export function adminPassword() {
  return cleanEnv(process.env.ADMIN_PASSWORD);
}

export function adminSessionSecret() {
  return cleanEnv(process.env.ADMIN_SESSION_SECRET);
}

export function secureAdminCookie() {
  return cleanEnv(process.env.ADMIN_COOKIE_SECURE).toLowerCase() === "true";
}

export function authEnvHint() {
  return "Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET to enable the login gate.";
}
