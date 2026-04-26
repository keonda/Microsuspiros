import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-quiet dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-sm uppercase tracking-wide text-moss dark:text-emerald-300">Private notes</p>
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Sign in to your Markdown workspace.</p>
        <AuthForm mode="login" />
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          New here?{" "}
          <Link className="font-medium text-clay dark:text-amber-300" href="/register">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
