import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import wordmark from "@/assets/yodawg-logo.svg";

interface SiteNavProps {
  /** "dark" = on hero (light text on navy). "light" = on cream pages. */
  variant?: "dark" | "light";
}

const SiteNav = ({ variant = "light" }: SiteNavProps) => {
  const { user, isSitter, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const onDark = variant === "dark";
  const isHome = location.pathname === "/";

  const linkBase = onDark
    ? "text-sm font-semibold text-foreground/75 transition-colors hover:text-foreground"
    : "text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground";
  const linkActive = onDark ? "text-foreground" : "text-foreground";

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
        <div aria-hidden className="h-10 w-[136px] sm:w-[176px]" />
      ) : (
        <Link to="/" className="flex items-center" aria-label="Back to Yo Dawg home">
          <img src={wordmark} alt="Yo Dawg" className="h-auto w-full max-w-[9.5rem] sm:max-w-[11.5rem]" loading="eager" />
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
        {isSitter && (
          <NavLink to="/sitter" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Dashboard</NavLink>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "md:hidden",
             onDark && "text-foreground hover:bg-foreground/10 hover:text-foreground",
          )}
          aria-label="Open menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              "hidden h-10 text-sm sm:inline-flex",
               onDark && "text-foreground hover:bg-foreground/10 hover:text-foreground",
            )}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        ) : (
          <Button
            asChild
            className={cn(
              "hidden h-10 rounded-full px-5 text-sm font-semibold transition-all hover:scale-[1.02] sm:inline-flex",
              onDark
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mx-5 mt-2 flex flex-col gap-1 rounded-xl border border-border bg-card p-3 text-foreground shadow-card md:hidden">
          <Link to="/#services" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Services</Link>
          <Link to="/book" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Book</Link>
          {user && (
            <>
              <Link to="/account" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Account</Link>
              <Link to="/account/profile" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Profile</Link>
            </>
          )}
          {isSitter && (
            <Link to="/sitter" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Dashboard</Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="px-3 py-2 text-left text-sm font-semibold">Sign out</button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold text-accent">Sign in</Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default SiteNav;
