import { ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/SiteNav";
import wordmark from "@/assets/yodawg-wordmark.svg";
import { dog3, dog5, dog8 } from "@/assets/dogs";

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-gradient-night text-primary-foreground">
      {/* Halftone overlay to match the illustrated comic style */}
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-halftone opacity-60" />

      {/* Warm orange glow — top right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.45), transparent 70%)" }}
      />
      {/* Yellow glow — bottom left */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--secondary) / 0.28), transparent 70%)" }}
      />

      <SiteNav variant="dark" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-6 sm:px-8 md:grid-cols-[1fr,1.05fr] md:gap-12 md:pb-32 md:pt-10">
        {/* Left — copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1.5 text-xs font-tag text-primary-foreground/85 backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5" />
            Hamilton, ON · est. 2015
          </span>

          <h1 className="mt-6 font-display text-[3.25rem] leading-[0.95] sm:text-6xl md:text-[5rem] lg:text-[5.75rem]">
            Walks for
            <br />
            <span className="text-accent">good boys</span>
            <br />
            <span className="font-serif italic font-normal text-secondary">& wild ones.</span>
          </h1>

          <p className="mt-7 max-w-lg text-lg leading-relaxed text-primary-foreground/75">
            Personal walks, drop-in sits, cozy overnight boarding and basic
            training — from one Hamilton dog person who treats your pup like
            their own.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:bg-accent"
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
              className="h-14 rounded-full px-5 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/#services">See services →</Link>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-primary-foreground/15 pt-8">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 text-secondary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <span className="text-sm font-semibold">5.0</span>
              <span className="text-sm text-primary-foreground/65">· 80+ happy pups</span>
            </div>
            <div className="text-sm text-primary-foreground/65">
              <span className="font-semibold text-primary-foreground">Insured</span> & first-aid certified
            </div>
          </div>
        </div>

        {/* Right — wordmark + dog illustration */}
        <div className="relative flex items-center justify-center">
          {/* soft circular backdrop behind the artwork */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 m-auto h-[420px] w-[420px] rounded-full blur-2xl sm:h-[520px] sm:w-[520px]"
            style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.22), transparent 70%)" }}
          />
          <img
            src={wordmark}
            alt="Yo Dawg — walks, sits, boards & plays for good boys (and girls)"
            className="relative w-full max-w-[560px] drop-shadow-[0_20px_40px_hsl(220_50%_4%/0.5)]"
            loading="eager"
          />

          {/* Floating since-2015 sticker */}
          <div className="absolute -right-2 top-4 z-10 grid h-24 w-24 -rotate-12 place-items-center rounded-full border-2 border-primary-foreground bg-secondary text-center font-display text-secondary-foreground shadow-pop-sm sm:right-4 sm:h-28 sm:w-28">
            <div className="leading-tight">
              <div className="text-[10px] font-tag">since</div>
              <div className="text-3xl">2015</div>
            </div>
          </div>

          {/* Floating dog buddies peeking around the wordmark */}
          <img
            src={dog5}
            alt=""
            aria-hidden
            className="absolute -left-4 top-2 z-10 h-20 w-auto -rotate-12 drop-shadow-[4px_4px_0_hsl(220_50%_4%/0.6)] sm:-left-6 sm:h-28"
          />
          <img
            src={dog8}
            alt=""
            aria-hidden
            className="absolute -bottom-2 right-2 z-10 h-20 w-auto rotate-6 drop-shadow-[4px_4px_0_hsl(220_50%_4%/0.6)] sm:-bottom-4 sm:right-10 sm:h-28"
          />

          {/* Floating quote with dog */}
          <div className="absolute -bottom-6 left-0 z-10 flex max-w-[280px] items-start gap-2 -rotate-2 rounded-2xl border-2 border-primary-foreground/90 bg-card p-3 pl-2 text-foreground shadow-pop-sm sm:-bottom-2 sm:left-4">
            <img src={dog3} alt="" aria-hidden className="h-12 w-auto shrink-0" />
            <div>
              <p className="font-serif text-sm italic leading-snug">
                "Comes home tired, happy and a little better behaved every time."
              </p>
              <p className="mt-1 text-xs font-tag text-muted-foreground">— Maya & Biscuit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee strip */}
      <div className="relative z-10 overflow-hidden border-y-2 border-primary-foreground/15 bg-accent py-3 text-accent-foreground">
        <div className="marquee flex gap-12 whitespace-nowrap font-display text-2xl">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g} className="flex shrink-0 items-center gap-12">
              <span>★ Walks</span>
              <span>★ Sits</span>
              <span>★ Boards</span>
              <span>★ Training</span>
              <span>★ Hamilton, ON</span>
              <span>★ Since 2015</span>
              <span>★ Insured</span>
              <span>★ Pet first-aid</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

export default HeroSection;
