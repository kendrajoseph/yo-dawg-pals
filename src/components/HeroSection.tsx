import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/SiteNav";
import heroDogs from "@/assets/hero-dogs.jpg";

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-canopy" />
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-grain opacity-60" />

      <SiteNav />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-12 sm:px-8 md:grid-cols-[1.1fr,1fr] md:gap-16 md:pb-32 md:pt-20">
        {/* Left — copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-tag text-muted-foreground backdrop-blur">
            <MapPin className="h-3.5 w-3.5" />
            Hamilton, Ontario
          </span>

          <h1 className="mt-6 font-display text-5xl leading-[1.02] text-primary sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Trail-tested
            <br />
            care for your
            <br />
            <span className="italic text-gradient-sunrise">good dog.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg">
            Personal walks, drop-in sits, overnight boarding and basic training —
            from a lifelong dog person who treats your pup like their own.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Link to="/book">
                Book a service
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Link to="/#services">See services →</Link>
            </Button>
          </div>

          {/* Stats / trust strip */}
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8">
            <div>
              <dt className="text-xs font-tag text-muted-foreground">Since</dt>
              <dd className="mt-1 font-display text-2xl text-primary">2015</dd>
            </div>
            <div>
              <dt className="text-xs font-tag text-muted-foreground">Insured</dt>
              <dd className="mt-1 font-display text-2xl text-primary">Fully</dd>
            </div>
            <div>
              <dt className="text-xs font-tag text-muted-foreground">Reviews</dt>
              <dd className="mt-1 font-display text-2xl text-primary">5.0★</dd>
            </div>
          </dl>
        </div>

        {/* Right — image */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevate">
            <img
              src={heroDogs}
              alt="A friendly group of dogs ready for a trail walk"
              className="h-auto w-full object-cover"
              loading="eager"
            />
          </div>
          {/* Subtle quote card */}
          <div className="absolute -bottom-6 -left-4 max-w-[260px] rounded-xl border border-border bg-card p-4 shadow-card sm:-left-8">
            <p className="font-display text-sm italic leading-snug text-foreground">
              "Comes home tired, happy, and a little better behaved every time."
            </p>
            <p className="mt-2 text-xs font-tag text-muted-foreground">Maya & Biscuit</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeroSection;
