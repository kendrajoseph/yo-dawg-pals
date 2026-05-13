import { ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import FloatingAssistant from "./FloatingAssistant";
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  MoreHorizontal,
  PawPrint,
  PieChart,
  Settings,
  Sparkles,
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
  { to: "/sitter/map", label: "Route map", icon: MapIcon },
  { to: "/sitter/clients", label: "Clients", icon: UserRound },
  { to: "/sitter/pets", label: "Pets", icon: PawPrint },
  { to: "/sitter/invoices", label: "Invoices", icon: CreditCard, badgeKey: "invoices" },
  { to: "/sitter/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
];

const SECONDARY: NavItem[] = [
  { to: "/sitter/assistant", label: "Assistant", icon: Sparkles },
  { to: "/sitter/reviews", label: "Reviews", icon: Star },
  { to: "/sitter/reports", label: "Reports", icon: PieChart },
  { to: "/sitter/settings/services", label: "Services", icon: Briefcase },
  { to: "/sitter/settings", label: "Settings", icon: Settings },
];

// 4 most-used + a "More" button (which opens the full sidebar sheet on mobile)
const BOTTOM_TABS: NavItem[] = [
  { to: "/sitter", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/sitter/inbox", label: "Inbox", icon: Inbox, badgeKey: "inbox" },
  { to: "/sitter/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/sitter/invoices", label: "Invoices", icon: CreditCard, badgeKey: "invoices" },
];

function NavList({ items, label }: { items: NavItem[]; label: string }) {
  const counts = useSitterCounts();
  const { state, isMobile, setOpenMobile } = useSidebar();
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
                    onClick={() => { if (isMobile) setOpenMobile(false); }}
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

function MobileBottomNav() {
  const counts = useSitterCounts();
  const { setOpenMobile } = useSidebar();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Sitter primary"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_TABS.map((item) => {
          const Icon = item.icon;
          const badge = item.badgeKey ? counts[item.badgeKey] : 0;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {badge > 0 && (
                  <span className="absolute right-3 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            aria-label="More navigation"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

const titleFor = (path: string): string => {
  if (path === "/sitter") return "Today";
  if (path.startsWith("/sitter/inbox")) return "Inbox";
  if (path.startsWith("/sitter/requests")) return "Request";
  if (path.startsWith("/sitter/calendar")) return "Calendar";
  if (path.startsWith("/sitter/map")) return "Route map";
  if (path.startsWith("/sitter/clients")) return "Clients";
  if (path.startsWith("/sitter/pets")) return "Pets";
  if (path.startsWith("/sitter/invoices")) return "Invoices";
  if (path.startsWith("/sitter/messages")) return "Messages";
  if (path.startsWith("/sitter/assistant")) return "Assistant";
  if (path.startsWith("/sitter/reviews")) return "Reviews";
  if (path.startsWith("/sitter/reports")) return "Reports";
  if (path.startsWith("/sitter/settings/services")) return "Services & pricing";
  if (path.startsWith("/sitter/settings")) return "Settings";
  return "Sitter";
};

function ShellInner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  // Always close the mobile sidebar sheet whenever the route changes
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <SitterSidebar />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="hidden md:inline-flex" />
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Operator</span>
            <ChevronRight className="hidden h-3.5 w-3.5 sm:inline" />
            <span className="truncate font-medium text-foreground">{titleFor(location.pathname)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {action}
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Switch to customer view"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Customer view
            </Link>
          </div>
        </header>
        <main className="flex-1 px-3 py-4 pb-24 sm:px-6 sm:py-6 md:px-8 md:pb-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <MobileBottomNav />
      <FloatingAssistant />
    </div>
  );
}

export function SitterShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <SidebarProvider>
      <ShellInner action={action}>{children}</ShellInner>
    </SidebarProvider>
  );
}
