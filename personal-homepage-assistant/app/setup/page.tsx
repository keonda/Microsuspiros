import { redirect } from "next/navigation";
import { setupAdmin } from "@/lib/actions";
import { hasAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdminUser()) redirect("/login");
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={setupAdmin} className="card w-full max-w-md space-y-4">
        <div>
          <p className="badge mb-3 inline-block">First run</p>
          <h1 className="text-3xl font-bold">Create your admin login</h1>
          <p className="mt-2 text-sm text-ink/60 dark:text-white/60">This account is stored in Postgres. No credentials live in environment variables.</p>
        </div>
        <input className="field" name="name" placeholder="Name" />
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="password" type="password" placeholder="Password, 10+ characters" minLength={10} required />
        <button className="btn btn-primary w-full">Create dashboard</button>
      </form>
    </main>
  );
}
