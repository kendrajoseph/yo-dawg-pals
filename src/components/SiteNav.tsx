import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import wordmark from "@/assets/yodawg-logo.svg";
import { track } from "@/integrations/posthog/PostHogProvider";

interface SiteNavProps {
  /** "dark" = on hero (light text on navy). "light" = on cream pages. */
  variant?: "dark" | "light";
}

const SiteNav = ({ variant = "light" }: SiteNavProps) => {
  const { user, canManageDashboard, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close mobile menu when viewport grows past md
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false); };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Lock body scroll when sheet open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  const onDark = variant === "dark";
  const isHome = location.pathname === "/";

  const linkBase = onDark
    ? "text-sm font-semibold text-primary/75 transition-colors hover:text-primary"
    : "text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground";
  const linkActive = onDark ? "text-primary" : "text-foreground";

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 backdrop-blur-sm sm:px-8 md:py-5 md:backdrop-blur-0",
        "md:relative md:top-auto",
        onDark
          ? "bg-hero/95 supports-[backdrop-filter]:bg-hero/88 md:bg-transparent"
          : "bg-background/95 supports-[backdrop-filter]:bg-background/88 md:bg-transparent",
      )}
    >
      {isHome ? (
        <div aria-hidden className="h-10 w-[136px] sm:w-[176px] md:w-[15rem]" />
      ) : (
        <Link to="/" className="flex items-center" aria-label="Back to Yo Dawg home">
          <img src={wordmark} alt="Yo Dawg" className="h-auto w-full max-w-[9.5rem] sm:max-w-[11.5rem] md:max-w-[15rem]" loading="eager" />
        </Link>
      )}

      <div className="hidden items-center gap-8 md:flex">
        <NavLink to="/#services" className={linkBase}>Services</NavLink>
        <NavLink to="/book" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Book</NavLink>
        {user && (
          <>
            <NavLink to="/account" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Account</NavLink>
            <NavLink to="/account/profile" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Profile</NavLink>
          </>
        )}
        {canManageDashboard && (
          <NavLink to="/sitter" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Dashboard</NavLink>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-11 w-11 md:hidden",
             onDark && "text-primary hover:bg-primary/10 hover:text-primary",
          )}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              "hidden h-10 text-sm md:inline-flex",
               onDark && "text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        ) : (
          <Button
            asChild
            className={cn(
              "hidden h-10 rounded-full px-5 text-sm font-semibold transition-all hover:scale-[1.02] md:inline-flex",
              onDark
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Link to="/auth" onClick={() => track("sign_in_clicked")}>Sign in</Link>
          </Button>
        )}
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[68px] z-30 bg-foreground/30 backdrop-blur-sm md:hidden"
          />
          {/* Sheet */}
          <div className="absolute inset-x-3 top-full z-40 mt-2 overflow-hidden rounded-2xl border-2 border-primary bg-card text-foreground shadow-pop md:hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display text-sm uppercase tracking-wider text-primary">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex flex-col py-2">
              {[
                { to: "/#services", label: "Services" },
                { to: "/book", label: "Book" },
                ...(user
                  ? [
                      { to: "/account", label: "Account" },
                      { to: "/account/profile", label: "Profile" },
                    ]
                  : []),
                ...(canManageDashboard ? [{ to: "/sitter", label: "Dashboard" }] : []),
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center px-5 py-3 text-base font-semibold text-foreground/85 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-3">
              {user ? (
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="h-12 w-full justify-center border-2 border-primary text-base font-semibold"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-12 w-full justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Link to="/auth" onClick={() => setOpen(false)}>Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default SiteNav;
