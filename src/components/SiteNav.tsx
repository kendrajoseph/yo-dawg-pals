import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SiteNavProps {
  /** "dark" = on hero (light text on navy). "light" = on cream pages. */
  variant?: "dark" | "light";
}

const SiteNav = ({ variant = "light" }: SiteNavProps) => {
  const { user, isSitter, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const onDark = variant === "dark";

  const linkBase = onDark
    ? "text-sm font-semibold text-primary-foreground/75 transition-colors hover:text-primary-foreground"
    : "text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground";
  const linkActive = onDark ? "text-primary-foreground" : "text-foreground";

  return (
    <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center" aria-label="Yo Dawg home">
        <span
          className={cn(
            "font-display text-2xl tracking-tight sm:text-[1.7rem]",
            onDark ? "text-primary-foreground" : "text-primary",
          )}
        >
          YO <span className="text-accent">DAWG</span>
        </span>
      </Link>

      <div className="hidden items-center gap-8 md:flex">
        <NavLink to="/#services" className={linkBase}>Services</NavLink>
        <NavLink to="/book" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Book</NavLink>
        {user && (
          <NavLink to="/account" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>Account</NavLink>
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
            onDark && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
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
              onDark && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
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
            <Link to="/account" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-semibold">Account</Link>
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
