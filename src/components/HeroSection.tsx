import { ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/SiteNav";
import heroDogs from "@/assets/hero-dogs.jpg";

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-canopy" />
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-grain opacity-50" />
      {/* Sun blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-20 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.5), transparent 70%)" }}
      />
      {/* Lime blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-60 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--secondary) / 0.35), transparent 70%)" }}
      />

      <SiteNav />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-8 sm:px-8 md:grid-cols-[1.15fr,1fr] md:gap-16 md:pb-32 md:pt-14">
        {/* Left — copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-card px-3 py-1.5 text-xs font-tag text-primary shadow-pop-sm">
            <MapPin className="h-3.5 w-3.5" />
            Hamilton, ON · est. 2015
          </span>

          <h1 className="mt-6 font-display text-[3.5rem] leading-[0.92] text-primary sm:text-7xl md:text-[5.5rem] lg:text-[6.5rem]">
            Walks for
            <br />
            <span className="font-serif italic text-clay">good boys</span>
            <br />
            <span className="inline-block">& wild ones.</span>
          </h1>

          <p className="mt-7 max-w-lg text-lg leading-relaxed text-foreground/75">
            Personal walks, drop-in sits, cozy overnight boarding and basic
            training — from one Hamilton dog person who treats your pup like
            their own.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-pop transition-transform hover:-translate-y-0.5 hover:bg-primary"
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
              className="h-14 rounded-full px-5 text-base font-semibold text-foreground hover:bg-muted"
            >
              <Link to="/#services">See services →</Link>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-8">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">5.0</span>
              <span className="text-sm text-muted-foreground">· 80+ happy pups</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Insured</span> & first-aid certified
            </div>
          </div>
        </div>

        {/* Right — image with playful badges */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl border-2 border-primary bg-card shadow-pop">
            <img
              src={heroDogs}
              alt="A friendly group of dogs ready for a trail walk"
              className="h-auto w-full object-cover"
              loading="eager"
            />
          </div>

          {/* Floating sticker — top right */}
          <div className="absolute -right-4 -top-5 grid h-24 w-24 animate-wiggle place-items-center rounded-full border-2 border-primary bg-accent text-center font-display text-accent-foreground shadow-pop-sm sm:-right-6 sm:h-28 sm:w-28">
            <div className="leading-tight">
              <div className="text-[10px] font-tag">since</div>
              <div className="text-3xl">2015</div>
            </div>
          </div>

          {/* Floating quote */}
          <div className="absolute -bottom-6 -left-4 max-w-[260px] -rotate-2 rounded-2xl border-2 border-primary bg-card p-4 shadow-pop-sm sm:-left-8">
            <p className="font-serif text-sm italic leading-snug text-foreground">
              "Comes home tired, happy and a little better behaved every time."
            </p>
            <p className="mt-2 text-xs font-tag text-muted-foreground">— Maya & Biscuit</p>
          </div>
        </div>
      </div>

      {/* Marquee strip */}
      <div className="relative z-10 overflow-hidden border-y-2 border-primary bg-primary py-3 text-primary-foreground">
        <div className="marquee flex gap-12 whitespace-nowrap font-display text-2xl">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g} className="flex shrink-0 items-center gap-12">
              <span>★ Walks</span>
              <span className="text-accent">★ Sits</span>
              <span>★ Boards</span>
              <span className="text-accent">★ Training</span>
              <span>★ Hamilton, ON</span>
              <span className="text-accent">★ Since 2015</span>
              <span>★ Insured</span>
              <span className="text-accent">★ Pet first-aid</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

export default HeroSection;
