import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, PawPrint, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const linkBase =
  "text-sm font-display uppercase tracking-wide text-foreground/80 transition-colors hover:text-accent";
const linkActive = "text-accent";

const SiteNav = () => {
  const { user, isSitter, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-pop-accent">
          <PawPrint className="h-5 w-5" />
        </span>
        <span className="font-logo text-2xl tracking-tight text-foreground sm:text-3xl">
          YO DAWG<span className="text-accent">.</span>
        </span>
      </Link>

      <div className="hidden items-center gap-7 md:flex">
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
            className="hidden h-10 font-display text-sm uppercase tracking-wide sm:inline-flex"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        ) : (
          <Button
            asChild
            className="hidden h-10 rounded-md bg-primary px-4 font-display text-sm uppercase tracking-wide text-primary-foreground shadow-pop-accent transition-transform hover:-translate-y-0.5 sm:inline-flex"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mx-5 flex flex-col gap-1 border-4 border-primary bg-card p-3 shadow-pop md:hidden">
          <Link to="/#services" onClick={() => setOpen(false)} className="px-3 py-2 font-display uppercase">
            Services
          </Link>
          <Link to="/book" onClick={() => setOpen(false)} className="px-3 py-2 font-display uppercase">
            Book
          </Link>
          {user && (
            <Link to="/account" onClick={() => setOpen(false)} className="px-3 py-2 font-display uppercase">
              Account
            </Link>
          )}
          {isSitter && (
            <Link to="/sitter" onClick={() => setOpen(false)} className="px-3 py-2 font-display uppercase">
              Dashboard
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="px-3 py-2 text-left font-display uppercase">
              Sign out
            </button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="px-3 py-2 font-display uppercase text-accent">
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default SiteNav;
