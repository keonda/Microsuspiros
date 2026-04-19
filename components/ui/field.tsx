import { cn } from "@/lib/format";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-mist">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-mist/55">{hint}</span> : null}
    </label>
  );
}

export function inputClass(className?: string) {
  return cn(
    "w-full rounded-lg border border-white/10 bg-ink/55 px-3 py-2 text-sm text-white outline-none transition placeholder:text-mist/35 focus:border-rose/60 focus:ring-2 focus:ring-rose/20",
    className
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink/35 px-3 py-2 text-sm text-mist/80">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-white/20 bg-ink text-rose" />
      {label}
    </label>
  );
}
