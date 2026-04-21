import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const linkBase =
  "text-sm font-medium text-foreground/70 transition-colors hover:text-foreground";
const linkActive = "text-foreground";

const SiteNav = () => {
  const { user, isSitter, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
      <Link to="/" className="flex items-baseline gap-2">
        <span className="font-logo text-2xl">Yo Dawg</span>
        <span className="hidden text-xs font-tag text-muted-foreground sm:inline">est. 2015</span>
      </Link>

      <div className="hidden items-center gap-8 md:flex">
        <NavLink to="/#services" className={linkBase}>
          Services
        </NavLink>
        <NavLink to="/book" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>
          Book
        </NavLink>
        {user && (
          <NavLink to="/account" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>
            Account
          </NavLink>
        )}
        {isSitter && (
          <NavLink to="/sitter" className={({ isActive }) => cn(linkBase, isActive && linkActive)}>
            Dashboard
          </NavLink>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="hidden h-10 text-sm sm:inline-flex"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        ) : (
          <Button
            asChild
            className="hidden h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mx-5 mt-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-3 shadow-card md:hidden">
          <Link to="/#services" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium">
            Services
          </Link>
          <Link to="/book" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium">
            Book
          </Link>
          {user && (
            <Link to="/account" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium">
              Account
            </Link>
          )}
          {isSitter && (
            <Link to="/sitter" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium">
              Dashboard
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="px-3 py-2 text-left text-sm font-medium">
              Sign out
            </button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium text-accent">
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default SiteNav;
