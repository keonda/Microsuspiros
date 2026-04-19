export const AUTH_COOKIE = "microsuspiros_admin";

export function isAuthConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

export function adminUsername() {
  return process.env.ADMIN_USERNAME ?? "";
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function adminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

export function authEnvHint() {
  return "Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET to enable the login gate.";
}
