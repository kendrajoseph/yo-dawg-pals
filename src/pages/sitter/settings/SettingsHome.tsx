import { Link } from "react-router-dom";
import { Briefcase, Clock, Bell, FileText, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SettingsLayout } from "./SettingsLayout";

const TILES = [
  { to: "/sitter/settings/services", icon: Briefcase, title: "Services & pricing", desc: "Define what you offer and how it's priced." },
  { to: "/sitter/settings/availability", icon: Clock, title: "Availability", desc: "Weekly hours, walk windows, blocked dates." },
  { to: "/sitter/settings/reminders", icon: Bell, title: "Reminders", desc: "Auto-send invoice reminders on a cadence." },
  { to: "/sitter/settings/templates", icon: FileText, title: "Templates", desc: "Email and SMS message templates." },
  { to: "/sitter/settings/branding", icon: Palette, title: "Branding", desc: "Logo and colours on invoices and emails." },
];

export default function SettingsHome() {
  return (
    <SettingsLayout title="Overview" description="Everything that configures how your business runs.">
      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="flex h-full items-start gap-3 border border-border p-4 shadow-soft transition-colors hover:bg-muted">
                <div className="rounded-md bg-muted p-2 text-foreground/70"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="font-display text-base text-primary">{t.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </SettingsLayout>
  );
}
