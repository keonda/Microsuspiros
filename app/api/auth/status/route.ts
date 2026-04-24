import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return Response.json({ authenticated: Boolean(user), user: user ? { email: user.email, role: user.role } : null });
}
