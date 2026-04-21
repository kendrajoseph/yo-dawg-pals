import { Link } from "react-router-dom";
import { PawPrint } from "lucide-react";

const SiteFooter = () => (
  <footer className="relative border-t-4 border-primary bg-primary text-primary-foreground">
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-6 md:grid-cols-3">
      <div>
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground shadow-pop">
            <PawPrint className="h-5 w-5" />
          </span>
          <span className="font-logo text-3xl tracking-tight">
            YO DAWG<span className="text-accent">.</span>
          </span>
        </Link>
        <p className="mt-4 max-w-xs text-sm opacity-80">
          Hamilton, Ontario · since 2015. Walks, sits, boards & basic training for every kind of good boy (and girl).
        </p>
      </div>
      <div>
        <h4 className="font-display text-sm uppercase tracking-wide text-accent">Services</h4>
        <ul className="mt-3 space-y-1.5 text-sm opacity-90">
          <li><Link to="/book?service=walk" className="hover:text-accent">Dog Walking</Link></li>
          <li><Link to="/book?service=sitting" className="hover:text-accent">Pet Sitting</Link></li>
          <li><Link to="/book?service=boarding" className="hover:text-accent">Boarding</Link></li>
          <li><Link to="/book?service=training" className="hover:text-accent">Training</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-display text-sm uppercase tracking-wide text-accent">Account</h4>
        <ul className="mt-3 space-y-1.5 text-sm opacity-90">
          <li><Link to="/auth" className="hover:text-accent">Sign in / sign up</Link></li>
          <li><Link to="/account" className="hover:text-accent">My bookings</Link></li>
          <li><Link to="/account/pets" className="hover:text-accent">My pets</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-primary-foreground/15 px-5 py-4 text-center text-xs opacity-70 sm:px-6">
      © {new Date().getFullYear()} Yo Dawg. Made with treats in Hamilton.
    </div>
  </footer>
);

export default SiteFooter;
