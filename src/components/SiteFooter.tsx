import { Link } from "react-router-dom";

const SiteFooter = () => (
  <footer className="relative bg-primary text-primary-foreground">
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">
      <div>
        <Link to="/" aria-label="Yo Dawg home" className="inline-block">
          <span className="font-display text-3xl tracking-tight text-primary-foreground">
            YO <span className="text-accent">DAWG</span>
          </span>
        </Link>
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
          Hamilton, Ontario. Since 2015. Personal dog care with premium solo walks, thoughtfully matched group walks, sitting, and boarding.
        </p>
      </div>
      <div>
        <h4 className="text-xs font-tag text-accent">Services</h4>
        <ul className="mt-4 space-y-2 text-sm text-primary-foreground/85">
          <li><Link to="/book?service=solo-walk" className="transition-colors hover:text-accent">Solo Walk</Link></li>
          <li><Link to="/book?service=group-walk" className="transition-colors hover:text-accent">Group Walk</Link></li>
          <li><Link to="/book?service=sitting" className="transition-colors hover:text-accent">Pet Sitting</Link></li>
          <li><Link to="/book?service=boarding" className="transition-colors hover:text-accent">Boarding</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-tag text-accent">Account</h4>
        <ul className="mt-4 space-y-2 text-sm text-primary-foreground/85">
          <li><Link to="/auth" className="transition-colors hover:text-accent">Sign in / sign up</Link></li>
          <li><Link to="/account" className="transition-colors hover:text-accent">My bookings</Link></li>
          <li><Link to="/account/pets" className="transition-colors hover:text-accent">My pets</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-primary-foreground/10 px-5 py-6 text-center text-xs text-primary-foreground/55 sm:px-8">
      © {new Date().getFullYear()} Yo Dawg
    </div>
  </footer>
);

export default SiteFooter;
