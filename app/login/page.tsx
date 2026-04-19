import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { authEnvHint, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isAuthConfigured()) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full">
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-rose">MicroSuspiros</p>
        <h1 className="text-2xl font-semibold text-white">Admin Login</h1>
        <p className="mt-2 text-sm leading-6 text-mist/65">Enter the local admin credentials configured for this deployment.</p>
        {params.error ? (
          <div className="mt-4 rounded-lg bg-red-500/12 p-3 text-sm text-red-100 ring-1 ring-red-300/20">
            <p>Those credentials did not match.</p>
          </div>
        ) : null}
        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <input name="username" className={inputClass()} placeholder="Username" autoComplete="username" required />
          <input name="password" type="password" className={inputClass()} placeholder="Password" autoComplete="current-password" required />
          <button className="w-full rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink hover:bg-rose/90">Sign in</button>
        </form>
        <p className="mt-4 text-xs text-mist/45">{authEnvHint()}</p>
      </Card>
    </div>
  );
}
