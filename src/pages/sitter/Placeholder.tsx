import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

/**
 * Placeholder for new sitter pages whose detailed implementation
 * still lives in the legacy /sitter-classic dashboard. Renders a
 * friendly message with a link to use the legacy view in the
 * meantime, so the new shell is never broken or empty.
 */
export default function SitterPagePlaceholder({ title, description, ctaLabel = "Open legacy view", ctaHref = "/sitter-classic" }: Props) {
  return (
    <SitterShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <EmptyState
        title="Moving in"
        description="This page is the new home for this section. While the move completes, full controls are still available in the legacy view."
        action={
          <Button asChild>
            <Link to={ctaHref}>
              <ExternalLink className="mr-2 h-4 w-4" />{ctaLabel}
            </Link>
          </Button>
        }
      />
    </SitterShell>
  );
}
