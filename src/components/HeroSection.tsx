import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/SiteNav";
import heroDogs from "@/assets/hero-dogs.jpg";

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-background texture-grain">
      {/* Canopy gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-canopy"
      />
      {/* Sun blob — neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 -z-0 h-[460px] w-[460px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--accent) / 0.55), transparent 70%)",
        }}
      />
      {/* Magenta spray blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-40 -z-0 h-[320px] w-[320px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--tag) / 0.35), transparent 70%)",
        }}
      />

      <SiteNav />

      {/* Top tag ticker */}
      <div className="relative z-10 overflow-hidden border-y-4 border-primary bg-primary text-primary-foreground">
        <div className="flex animate-marquee whitespace-nowrap gap-10 py-2 font-tag text-xl">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group} className="flex shrink-0 gap-10">
              <span>★ walks</span>
              <span className="text-accent">★ sits</span>
              <span>★ boards</span>
              <span className="text-accent">★ training</span>
              <span>★ since 2015</span>
              <span className="text-accent">★ hamilton, on</span>
              <span>★ insured</span>
              <span className="text-accent">★ pet first-aid</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-10 text-center sm:px-6 md:pt-16">
        {/* Tag */}
        <div className="mb-6 inline-flex -rotate-2 items-center gap-2">
          <Sparkles className="h-5 w-5 text-tag" />
          <span className="font-tag text-2xl text-clay sm:text-3xl">
            <span className="scrawl-tag text-primary-foreground">Hamilton, ON</span> · since '15
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-logo text-[clamp(3.5rem,16vw,11rem)] leading-[0.9] tracking-tight text-primary spray-glow">
          YO
          <br />
          <span className="text-gradient-spray">DAWG</span>
          <span className="text-tag">.</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-7 max-w-xl text-base text-foreground/80 sm:text-lg">
          Walks, sits, boards & basic training for every kind of{" "}
          <span className="font-tag text-2xl text-clay sm:text-3xl">
            good boy
          </span>{" "}
          (and girl).
        </p>

        {/* CTA */}
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="group h-14 rounded-md bg-accent px-8 font-display text-base uppercase tracking-wide text-accent-foreground shadow-pop transition-transform hover:-translate-y-1 hover:translate-x-0"
          >
            <Link to="/book">
              Book a service
              <ArrowRight className="ml-1 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 rounded-md border-4 border-primary bg-card px-8 font-display text-base uppercase tracking-wide text-primary shadow-pop-tag transition-transform hover:-translate-y-1 hover:bg-tag hover:text-tag-foreground"
          >
            <Link to="/#services">See services</Link>
          </Button>
        </div>

        {/* Illustration card — taped poster style */}
        <div className="relative mx-auto mt-16 max-w-4xl sm:mt-20">
          {/* Tape */}
          <div
            aria-hidden
            className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rotate-3 bg-tag/80 shadow-soft"
          />
          <div
            aria-hidden
            className="absolute -top-2 right-10 z-10 h-5 w-14 -rotate-12 bg-accent/80 shadow-soft"
          />
          <div className="drip-bottom relative -rotate-1 border-4 border-primary bg-card p-3 shadow-pop-lg transition-transform duration-500 hover:rotate-0 sm:p-6">
            {/* Stamp */}
            <div className="stamp animate-spray-pulse absolute -right-3 -top-4 z-10 grid h-20 w-20 place-items-center rounded-full bg-tag font-display text-tag-foreground shadow-pop sm:-right-5 sm:-top-5 sm:h-24 sm:w-24">
              <div className="text-center leading-tight">
                <div className="font-tag text-sm normal-case sm:text-base">since</div>
                <div className="text-2xl sm:text-3xl">2015</div>
              </div>
            </div>
            {/* Corner scrawl */}
            <div className="absolute -left-4 -bottom-3 z-10 -rotate-6 bg-accent px-3 py-1 font-tag text-lg text-accent-foreground shadow-pop sm:text-xl">
              tail-wag guaranteed
            </div>
            <img
              src={heroDogs}
              alt="Hand-drawn illustration of eight quirky dogs with the caption Dog Walking & Basic Training"
              className="mx-auto h-auto w-full"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeroSection;
