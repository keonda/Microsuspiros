"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={action} className="card w-full max-w-md space-y-4">
        <div>
          <p className="badge mb-3 inline-block">Private</p>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-ink/60 dark:text-white/60">Sign in to your personal homepage assistant.</p>
        </div>
        {state?.error && <p className="rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold text-coral">{state.error}</p>}
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="password" type="password" placeholder="Password" required />
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in" : "Login"}</button>
      </form>
    </main>
  );
}
