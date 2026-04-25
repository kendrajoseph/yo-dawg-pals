import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  PawPrint,
  PieChart,
  Settings,
  Star,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSitterCounts } from "@/hooks/useSitterCounts";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: "inbox" | "invoices" | "messages";
  end?: boolean;
};

const PRIMARY: NavItem[] = [
  { to: "/sitter", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/sitter/inbox", label: "Inbox", icon: Inbox, badgeKey: "inbox" },
  { to: "/sitter/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/sitter/clients", label: "Clients", icon: UserRound },
  { to: "/sitter/pets", label: "Pets", icon: PawPrint },
  { to: "/sitter/invoices", label: "Invoices", icon: CreditCard, badgeKey: "invoices" },
  { to: "/sitter/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
];

const SECONDARY: NavItem[] = [
  { to: "/sitter/reviews", label: "Reviews", icon: Star },
  { to: "/sitter/reports", label: "Reports", icon: PieChart },
  { to: "/sitter/settings", label: "Settings", icon: Settings },
];

function NavList({ items, label }: { items: NavItem[]; label: string }) {
  const counts = useSitterCounts();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-[11px] uppercase tracking-wider">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const badge = item.badgeKey ? counts[item.badgeKey] : 0;
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SitterSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-card">
        <div className="px-3 pt-4 pb-2">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="font-display text-lg text-primary">Yodawg</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Operator</span>
          </NavLink>
        </div>
        <NavList items={PRIMARY} label="Workspace" />
        <NavList items={SECONDARY} label="Setup" />
      </SidebarContent>
    </Sidebar>
  );
}

const titleFor = (path: string): string => {
  if (path === "/sitter") return "Today";
  if (path.startsWith("/sitter/inbox")) return "Inbox";
  if (path.startsWith("/sitter/calendar")) return "Calendar";
  if (path.startsWith("/sitter/clients")) return "Clients";
  if (path.startsWith("/sitter/pets")) return "Pets";
  if (path.startsWith("/sitter/invoices")) return "Invoices";
  if (path.startsWith("/sitter/messages")) return "Messages";
  if (path.startsWith("/sitter/reports")) return "Reports";
  if (path.startsWith("/sitter/settings")) return "Settings";
  return "Sitter";
};

export function SitterShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const location = useLocation();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SitterSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Operator</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{titleFor(location.pathname)}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">{action}</div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
