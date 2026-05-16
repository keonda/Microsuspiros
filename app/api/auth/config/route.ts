function cleanEnvValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function GET() {
  const email = cleanEnvValue(process.env.SINGLE_USER_EMAIL ?? "attendant@example.com").toLowerCase();
  const singleUserMode = cleanEnvValue(process.env.SINGLE_USER_MODE ?? "true").toLowerCase() !== "false";
  const passwordSource = cleanEnvValue(process.env.SINGLE_USER_PASSWORD_B64) ? "base64" : "plain";

  return Response.json({
    singleUserMode,
    email,
    passwordConfigured: Boolean(cleanEnvValue(process.env.SINGLE_USER_PASSWORD_B64) || cleanEnvValue(process.env.SINGLE_USER_PASSWORD)),
    passwordSource,
  });
}
