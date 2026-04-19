import Link from "next/link";
import { BookOpenText, Home, ListMusic, Sparkles, Workflow } from "lucide-react";
import { isAuthConfigured } from "@/lib/auth";

const nav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/songs", label: "Songs", icon: BookOpenText },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/workflow", label: "Workflow", icon: Workflow }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const authEnabled = isAuthConfigured();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-white/10 bg-ink/80 backdrop-blur lg:fixed lg:inset-y-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-rose/15 text-rose ring-1 ring-rose/25">
            <Sparkles size={21} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-rose">MicroSuspiros</p>
            <h1 className="font-semibold text-mist">Admin Panel</h1>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-2 lg:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-max items-center gap-3 rounded-lg px-3 py-2 text-sm text-mist/75 transition hover:bg-white/8 hover:text-white"
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:ml-72 lg:min-h-screen lg:flex-1">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-night/80 px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold">Local admin mode</p>
              <p className="text-sm text-mist/70">{authEnabled ? "Login gate enabled for this deployment." : "No auth wall until admin env vars are configured."}</p>
            </div>
            <div className="flex items-center gap-2">
              {authEnabled ? (
                <form action="/api/auth/logout" method="post">
                  <button className="rounded-lg bg-white/8 px-4 py-2 text-sm font-semibold text-mist ring-1 ring-white/10 hover:bg-white/12">Logout</button>
                </form>
              ) : null}
              <Link href="/songs/new" className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink hover:bg-rose/90">
                New Song
              </Link>
            </div>
          </div>
        </header>
        <div className="px-5 py-7 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
