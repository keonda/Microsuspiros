import Link from "next/link";
import { logout } from "@/lib/auth";
import { Bot, CalendarDays, CheckSquare, Globe2, Home, Link2, LogOut, NotebookPen, PlaySquare, Search, Settings, Sparkles } from "lucide-react";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/sites", label: "Sites", icon: Globe2 },
  { href: "/channels", label: "Channels", icon: PlaySquare },
  { href: "/projects", label: "Projects", icon: Sparkles },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-20 border-b border-ink/10 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-ink/80 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <Link href="/dashboard" className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-ink text-white dark:bg-white dark:text-ink">
            <Sparkles size={21} />
          </div>
          <div>
            <p className="font-bold">Homepage Assistant</p>
            <p className="text-xs text-ink/55 dark:text-white/55">Your private command center</p>
          </div>
        </Link>
        <nav className="grid grid-cols-5 gap-1 lg:block lg:space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center justify-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink/68 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white lg:justify-start">
              <item.icon size={18} />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
        <form action={logout} className="mt-6 hidden lg:block">
          <button className="btn btn-soft w-full">
            <LogOut size={16} />
            Logout
          </button>
        </form>
      </aside>
      <main className="flex-1 px-4 py-5 md:px-8 lg:px-10">
        <header className="mb-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink/55 dark:text-white/55">
            <Search size={16} />
            <span>Search everything</span>
          </div>
          <div className="flex gap-2">
            <SearchBox />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
