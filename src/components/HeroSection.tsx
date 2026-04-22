import { ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteNav from "@/components/SiteNav";
import wordmark from "@/assets/yodawg-logo.svg";
import { dog3 } from "@/assets/dogs";

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-hero text-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-halftone opacity-60" />

        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--hero-glow) / 0.7), transparent 70%)" }}
        />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--secondary) / 0.28), transparent 70%)" }}
      />

      <SiteNav variant="dark" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-7 px-5 pb-12 pt-2 sm:gap-8 sm:px-8 sm:pb-16 sm:pt-5 md:grid-cols-[1fr,1.02fr] md:gap-10 md:pb-24 md:pt-8">
        <div>
          <img
            src={wordmark}
            alt="Yo Dawg"
            className="mx-auto -translate-x-[2px] h-auto w-full max-w-none rounded-sm border-0 text-lg opacity-100 sm:translate-x-0 sm:mx-0 sm:max-w-[48rem] md:max-w-[54rem]"
            loading="eager"
          />

          <h1 className="mt-4 font-display text-[2.35rem] leading-[0.95] sm:mt-5 sm:text-5xl md:text-[4.35rem] lg:text-[5rem]">
            Thoughtful care
            <br />
            for <span className="text-accent">Hamilton dogs</span>
            <br />
            <span className="font-serif italic font-normal text-secondary">and the people who love them.</span>
          </h1>

          <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-primary/75 sm:mt-6 sm:text-[1.05rem]">
            Premium solo walks, carefully matched group walks, dependable drop-in sits, and cozy home-style boarding — with timing and care shaped around what actually works for your dog.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group h-13 w-full rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:bg-accent sm:h-14 sm:w-auto"
            >
              <Link to="/book">
                Book care
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
               className="h-12 w-full rounded-full px-5 text-base font-semibold text-primary hover:bg-primary/10 hover:text-primary sm:h-14 sm:w-auto"
            >
               <Link to="/#services">How it works →</Link>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-primary/15 pt-5 sm:mt-10 sm:gap-x-7 sm:gap-y-4 sm:pt-7">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 text-secondary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <span className="text-sm font-semibold">5.0</span>
              <span className="text-sm text-primary/65">· trusted by 80+ Hamilton pups</span>
            </div>
            <div className="text-sm text-primary/65">
              <span className="font-semibold text-primary">Insured</span> & pet first-aid certified
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 m-auto h-[420px] w-[420px] rounded-full blur-2xl sm:h-[520px] sm:w-[520px]"
             style={{ background: "radial-gradient(closest-side, hsl(var(--secondary) / 0.3), transparent 70%)" }}
          />
          <img
            src={dog3}
            alt="Illustration of a happy dog"
            className="relative h-auto w-full max-w-[360px] rotate-[-4deg] drop-shadow-[0_20px_40px_hsl(220_50%_4%/0.5)] sm:max-w-[420px]"
            loading="eager"
          />

           <div className="absolute -right-1 top-2 z-10 grid h-20 w-20 -rotate-12 place-items-center rounded-full border-2 border-primary bg-secondary text-center font-display text-secondary-foreground shadow-pop-sm sm:right-4 sm:top-4 sm:h-28 sm:w-28">
            <div className="leading-tight">
              <div className="text-[10px] font-tag">since</div>
              <div className="text-2xl sm:text-3xl">2015</div>
            </div>
          </div>

           <div className="absolute -bottom-4 left-1 z-10 max-w-[260px] -rotate-2 rounded-2xl border-2 border-primary/90 bg-card p-2.5 text-card-foreground shadow-pop-sm sm:-bottom-2 sm:left-4 sm:max-w-[280px] sm:p-3">
            <div>
              <p className="font-serif text-xs italic leading-snug sm:text-sm">
                "The walks feel personal, structured, and exactly right for our dog."
              </p>
              <p className="mt-1 text-[10px] font-tag text-muted-foreground sm:text-xs">— Maya & Biscuit</p>
            </div>
          </div>
        </div>
      </div>

    </header>
  );
};

export default HeroSection;
