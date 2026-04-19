import { cn } from "@/lib/format";

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-soft", className)} {...props}>{children}</section>;
}

export function CardTitle({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <div className="mb-4">
      {eyebrow ? <p className="text-xs uppercase tracking-[0.16em] text-gold">{eyebrow}</p> : null}
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}
