import { cn } from "@/lib/format";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-rose text-ink hover:bg-rose/90",
        variant === "secondary" && "bg-white/8 text-mist ring-1 ring-white/10 hover:bg-white/12",
        variant === "danger" && "bg-red-500/15 text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
