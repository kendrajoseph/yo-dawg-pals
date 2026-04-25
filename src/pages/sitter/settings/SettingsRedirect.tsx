import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "./SettingsLayout";

export default function SettingsRedirect({
  title,
  description,
  hash,
}: {
  title: string;
  description: string;
  hash: string;
}) {
  return (
    <SettingsLayout title={title} description={description}>
      <Card className="border border-dashed border-border bg-card/50 p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">
          We're moving this section into Settings. While that wraps up, edit it from the classic dashboard.
        </p>
        <Button className="mt-4" asChild>
          <Link to={`/sitter-classic${hash}`}>Open in classic dashboard <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
        </Button>
      </Card>
    </SettingsLayout>
  );
}
