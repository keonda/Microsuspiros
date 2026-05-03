import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasAdminUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/dashboard");
  redirect("/login");
}
