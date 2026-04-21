import { ArrowRight } from "lucide-react";
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
      {/* Sun blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 -z-0 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--accent) / 0.45), transparent 70%)",
        }}
      />

      <SiteNav />

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-8 text-center sm:px-6 md:pt-16">
        {/* Tag */}
        <div className="mb-6 inline-block -rotate-2">
          <span className="font-tag text-2xl text-accent sm:text-3xl">
            Hamilton, ON · since 2015
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-[clamp(3.5rem,15vw,10rem)] leading-[0.85] tracking-tight text-primary">
          YO
          <br />
          <span className="text-gradient-sunlight">DAWG</span>
          <span className="text-accent">.</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-6 max-w-xl text-base text-foreground/75 sm:text-lg">
          Walks, sits, boards & basic training for every kind of{" "}
          <span className="font-tag text-2xl text-clay sm:text-3xl">
            good boy
          </span>{" "}
          (and girl).
        </p>

        {/* CTA */}
        <div className="mt-8 flex justify-center sm:mt-10">
          <Button
            asChild
            size="lg"
            className="group h-14 rounded-md bg-primary px-8 font-display text-base uppercase tracking-wide text-primary-foreground shadow-pop-accent transition-transform hover:-translate-y-1 hover:translate-x-0"
          >
            <Link to="/book">
              Book a service
              <ArrowRight className="ml-1 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {/* Illustration card — taped poster style */}
        <div className="relative mx-auto mt-14 max-w-4xl sm:mt-20">
          {/* Tape */}
          <div
            aria-hidden
            className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rotate-3 bg-accent/70 shadow-soft"
          />
          <div className="relative -rotate-1 border-4 border-primary bg-card p-3 shadow-pop transition-transform duration-500 hover:rotate-0 sm:p-6">
            {/* Stamp */}
            <div className="stamp absolute -right-3 -top-4 z-10 grid h-20 w-20 place-items-center rounded-full bg-accent font-display text-accent-foreground shadow-pop sm:-right-5 sm:-top-5 sm:h-24 sm:w-24">
              <div className="text-center leading-tight">
                <div className="font-tag text-sm normal-case sm:text-base">since</div>
                <div className="text-2xl sm:text-3xl">2015</div>
              </div>
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
