"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/actions/writer-actions";

type AuthFormProps = {
  mode: "login" | "register";
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="rounded-xl bg-paper p-6 text-ink shadow-soft ring-1 ring-black/5">
      <h2 className="font-serif text-2xl font-bold">{isRegister ? "Create your studio" : "Welcome back"}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        {isRegister ? "The first registered user becomes the administrator." : "Log in to continue writing."}
      </p>
      {state.error ? <p className="mt-4 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p> : null}
      <div className="mt-6 space-y-4">
        {isRegister ? (
          <label className="block text-sm font-medium">
            Display name
            <input className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2" name="displayName" required />
          </label>
        ) : null}
        <label className="block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2" name="email" type="email" required />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2" name="password" type="password" minLength={8} required />
        </label>
      </div>
      <button className="mt-6 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-parchment disabled:opacity-60" disabled={pending}>
        {pending ? "Working..." : isRegister ? "Register" : "Login"}
      </button>
      <p className="mt-5 text-center text-sm text-stone-600">
        {isRegister ? "Already have an account?" : "New here?"}{" "}
        <Link className="font-semibold text-cedar" href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Login" : "Register"}
        </Link>
      </p>
    </form>
  );
}
