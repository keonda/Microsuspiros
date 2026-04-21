import { cn } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";

export function DashboardSectionCard({
  title,
  eyebrow,
  compact = false,
  collapsed = false,
  children
}: {
  title: string;
  eyebrow?: string;
  compact?: boolean;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(compact && "p-4")}>
      <details open={!collapsed} className="group">
        <summary className="cursor-pointer list-none">
          <CardTitle title={title} eyebrow={eyebrow} />
        </summary>
        <div className={cn("mt-4", compact ? "space-y-3" : "space-y-4")}>{children}</div>
      </details>
    </Card>
  );
}
