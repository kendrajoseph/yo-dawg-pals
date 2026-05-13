import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/sitter/settings", label: "Overview", end: true },
  { to: "/sitter/settings/services", label: "Services & pricing" },
  { to: "/sitter/settings/availability", label: "Availability" },
  { to: "/sitter/settings/reminders", label: "Reminders" },
  { to: "/sitter/settings/templates", label: "Templates" },
  { to: "/sitter/settings/branding", label: "Branding" },
];

export function SettingsLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <SitterShell>
      <Link to="/sitter" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your services, availability, and communications.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <nav className="flex flex-col gap-1 text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 transition-colors",
                    isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl text-primary">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </section>
      </div>
    </SitterShell>
  );
}
