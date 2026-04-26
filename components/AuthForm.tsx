"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name") || undefined,
        password: formData.get("password")
      })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not continue");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={submit} className="mt-8 space-y-4">
      {mode === "register" ? (
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Name</span>
          <input
            name="name"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-moss dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Email</span>
        <input
          required
          type="email"
          name="email"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-moss dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Password</span>
        <input
          required
          minLength={8}
          type="password"
          name="password"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-moss dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      <button
        disabled={loading}
        className="w-full rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
      >
        {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
