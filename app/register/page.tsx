import { registerAction } from "@/actions/writer-actions";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="register" action={registerAction} />;
}
