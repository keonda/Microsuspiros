import type { Metadata } from "next";
import { Merriweather, Inter } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "@/actions/writer-actions";
import { BookOpen, LogOut, Search, Settings, Shield, Sparkles } from "lucide-react";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Writer Studio",
  description: "A private writing workspace for novels, notes, research, brainstorms, and resources."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className={`${inter.variable} ${merriweather.variable} font-sans`}>
        {user ? (
          <div className="min-h-screen">
            <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--toolbar-background)] backdrop-blur">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                    <BookOpen className="size-5" />
                  </span>
                  <span>
                    <span className="block font-serif text-lg font-bold leading-tight text-[var(--foreground)]">Writer Studio</span>
                    <span className="block text-xs text-[var(--muted-foreground)]">Private writing workspace</span>
                  </span>
                </Link>
                <nav className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Link className="hidden items-center gap-2 rounded-md px-3 py-2 hover:bg-[var(--muted)] hover:text-[var(--foreground)] sm:flex" href="/search">
                    <Search className="size-4" /> Search
                  </Link>
                  {user.role === "ADMIN" ? (
                    <Link className="hidden items-center gap-2 rounded-md px-3 py-2 hover:bg-[var(--muted)] hover:text-[var(--foreground)] sm:flex" href="/admin">
                      <Shield className="size-4" /> Admin
                    </Link>
                  ) : null}
                  <Link className="hidden items-center gap-2 rounded-md px-3 py-2 hover:bg-[var(--muted)] hover:text-[var(--foreground)] sm:flex" href="/settings">
                    <Settings className="size-4" /> Settings
                  </Link>
                  <span className="hidden rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] sm:inline-flex">{user.displayName}</span>
                  <form action={logoutAction}>
                    <button className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[var(--muted)] hover:text-[var(--foreground)]" type="submit">
                      <LogOut className="size-4" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </form>
                </nav>
              </div>
            </header>
            {children}
          </div>
        ) : (
          <main className="min-h-screen bg-ink text-parchment">
            <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr]">
              <section>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-parchment/15 px-3 py-1 text-sm text-parchment/70">
                  <Sparkles className="size-4" /> Drafts, notes, research, and resources
                </div>
                <h1 className="font-serif text-5xl font-bold leading-tight md:text-6xl">Writer Studio</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-parchment/75">
                  A calm, private studio for building long-form stories from first spark to finished manuscript.
                </p>
              </section>
              {children}
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
