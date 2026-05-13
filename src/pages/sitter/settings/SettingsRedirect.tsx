import { Card } from "@/components/ui/card";
import { SettingsLayout } from "./SettingsLayout";

export default function SettingsRedirect({
  title,
  description,
}: {
  title: string;
  description: string;
  hash?: string;
}) {
  return (
    <SettingsLayout title={title} description={description}>
      <Card className="border border-dashed border-border bg-card/50 p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">
          This section is coming soon. We're rebuilding it inside the new Settings experience.
        </p>
      </Card>
    </SettingsLayout>
  );
}
