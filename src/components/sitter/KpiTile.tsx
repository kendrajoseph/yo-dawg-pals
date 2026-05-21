import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
  active = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "warning" ? "text-amber-700"
    : tone === "danger" ? "text-red-700"
    : tone === "success" ? "text-emerald-700"
    : "text-primary";

  const interactive = !!onClick;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-soft transition-colors",
        interactive && "cursor-pointer hover:border-foreground/30 hover:bg-muted/40",
        active && "border-foreground/40 bg-muted/40 ring-1 ring-foreground/20",
      )}
    >
      {icon && <div className="rounded-md bg-muted p-2 text-foreground/70">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("mt-1 font-display text-2xl leading-none sm:text-3xl", toneClass)}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </Card>
  );
}
