import { Link } from "react-router-dom";
import { dogs } from "@/assets/dogs";

const SiteFooter = () => (
  <footer className="relative bg-primary text-primary-foreground">
    {/* Dog pack strip */}
    <div className="overflow-hidden border-t-2 border-primary-foreground/15 bg-secondary py-4">
      <div className="marquee flex gap-8 whitespace-nowrap">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} className="flex shrink-0 items-end gap-8">
            {dogs.map((d, i) => (
              <img
                key={`${g}-${i}`}
                src={d}
                alt=""
                aria-hidden
                className="h-14 w-auto sm:h-16"
                style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 4}deg)` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>

    {/* Marquee strip */}
    <div className="overflow-hidden border-y border-primary-foreground/10 bg-accent py-3 text-accent-foreground">
      <div className="marquee flex gap-12 whitespace-nowrap font-display text-2xl">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} className="flex shrink-0 items-center gap-12">
            <span>★ Walks</span>
            <span>★ Sits</span>
            <span>★ Boards</span>
            <span>★ Trains</span>
            <span>★ Treats</span>
            <span>★ Hamilton, ON</span>
            <span>★ Since 2015</span>
          </div>
        ))}
      </div>
    </div>

    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">
      <div>
        <Link to="/" aria-label="Yo Dawg home" className="inline-block">
          <span className="font-display text-3xl tracking-tight text-primary-foreground">
            YO <span className="text-accent">DAWG</span>
          </span>
        </Link>
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
          Hamilton, Ontario. Since 2015. Walks, sits, boards & basic training
          for every kind of good boy (and girl).
        </p>
      </div>
      <div>
        <h4 className="text-xs font-tag text-accent">Services</h4>
        <ul className="mt-4 space-y-2 text-sm text-primary-foreground/85">
          <li><Link to="/book?service=walk" className="transition-colors hover:text-accent">Dog Walking</Link></li>
          <li><Link to="/book?service=sitting" className="transition-colors hover:text-accent">Pet Sitting</Link></li>
          <li><Link to="/book?service=boarding" className="transition-colors hover:text-accent">Boarding</Link></li>
          <li><Link to="/book?service=training" className="transition-colors hover:text-accent">Training</Link></li>
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
      © {new Date().getFullYear()} Yo Dawg · Made with treats in Hamilton, Ontario
    </div>
  </footer>
);

export default SiteFooter;
