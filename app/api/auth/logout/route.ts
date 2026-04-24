import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return Response.redirect(new URL("/login", process.env.BASE_URL || "http://localhost:3000"));
}
