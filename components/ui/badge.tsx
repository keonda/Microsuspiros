import type { SongStatus } from "@prisma/client";
import { cn, statusLabel } from "@/lib/format";

const styles: Record<SongStatus, string> = {
  DRAFT: "bg-white/8 text-mist ring-white/10",
  IN_PROGRESS: "bg-gold/15 text-gold ring-gold/25",
  READY: "bg-moss/18 text-green-100 ring-moss/30",
  PUBLISHED: "bg-rose/18 text-rose ring-rose/30",
  ARCHIVED: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/20"
};

export function StatusBadge({ status }: { status: SongStatus }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1", styles[status])}>{statusLabel(status)}</span>;
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-mist/80 ring-1 ring-white/10">{children}</span>;
}
