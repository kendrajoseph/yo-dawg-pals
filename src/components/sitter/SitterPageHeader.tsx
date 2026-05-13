import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SitterPageHeaderProps {
  /** Optional "back" link rendered above the title. */
  back?: { to: string; label: string };
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned action area (buttons, etc.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared header for sitter dashboard pages.
 * Replaces the hand-rolled `Back link + h1 + p` pattern that was duplicated
 * across every page in src/pages/sitter/*.
 */
export function SitterPageHeader({ back, title, description, actions, className }: SitterPageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-primary sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
