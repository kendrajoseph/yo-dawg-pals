import { ArrowRight, Sparkles, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroDogs from "@/assets/hero-dogs.jpg";

const PawScribble = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M7 14c0 2 2 3 5 3s5-1 5-3-2-3-5-3-5 1-5 3z"
      fill="currentColor"
    />
    <circle cx="6" cy="9" r="1.6" fill="currentColor" />
    <circle cx="10" cy="6" r="1.6" fill="currentColor" />
    <circle cx="14" cy="6" r="1.6" fill="currentColor" />
    <circle cx="18" cy="9" r="1.6" fill="currentColor" />
  </svg>
);

const HeroSection = () => {
  return (
    <header className="relative overflow-hidden bg-background">
      {/* Gradient wash background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-sunset-soft opacity-70"
      />
      {/* Radial blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] -z-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--accent) / 0.35), transparent 70%)",
        }}
      />

      {/* Decorative paw prints */}
      <PawScribble className="absolute left-[6%] top-32 h-10 w-10 -rotate-12 text-primary/30" />
      <PawScribble className="absolute right-[8%] top-44 h-8 w-8 rotate-12 text-accent/40" />
      <PawScribble className="absolute left-[12%] bottom-24 h-12 w-12 rotate-6 text-highlight/30" />
      <PawScribble className="absolute right-[10%] bottom-40 h-9 w-9 -rotate-6 text-primary/30" />

      {/* Top nav */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <a href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-sunset text-primary-foreground shadow-soft">
            <PawPrint className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl tracking-tight text-foreground">
            Yo Dawg<span className="text-primary">.</span>
          </span>
        </a>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#services" className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary">
            Services
          </a>
          <a href="#sitters" className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary">
            Sitters
          </a>
          <a href="#how" className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary">
            How it works
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex">
            Log in
          </Button>
          <Button className="bg-gradient-sunset text-primary-foreground shadow-soft transition-transform hover:scale-105 hover:shadow-pop">
            Sign up
          </Button>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12 text-center md:pt-20">
        {/* Trust chip */}
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold text-foreground/80 shadow-soft backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Trusted by 2,000+ pet parents
        </div>

        {/* Headline */}
        <h1 className="font-display text-[clamp(4rem,14vw,11rem)] leading-[0.9] tracking-tight">
          <span className="text-gradient-sunset">Yo Dawg</span>
          <span className="text-foreground">.</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Walks, sits, boards & trains — for every kind of{" "}
          <span className="font-hand text-2xl text-accent sm:text-3xl">
            good boy
          </span>{" "}
          (and girl).
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="group h-14 rounded-full bg-gradient-sunset px-8 text-base font-semibold text-primary-foreground shadow-pop transition-transform hover:scale-105"
          >
            Book a sitter
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 rounded-full border-2 border-foreground/15 bg-card px-8 text-base font-semibold hover:border-primary hover:text-primary"
          >
            Become a sitter
          </Button>
        </div>

        {/* Illustration card */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-sunset opacity-30 blur-2xl"
          />
          <div className="group relative -rotate-1 rounded-3xl border-2 border-foreground/10 bg-card p-4 shadow-pop transition-transform duration-500 hover:rotate-0 sm:p-8">
            {/* Sticker badge */}
            <div className="absolute -right-4 -top-4 z-10 grid h-20 w-20 place-items-center rounded-full bg-accent text-center text-accent-foreground shadow-pop sm:-right-6 -top-6 sm:h-24 sm:w-24">
              <div className="rotate-12">
                <div className="font-hand text-lg leading-none sm:text-xl">since</div>
                <div className="font-display text-xl sm:text-2xl">2024</div>
              </div>
            </div>
            <img
              src={heroDogs}
              alt="Hand-drawn illustration of eight quirky dogs and a rabbit with the caption Dog Walking & Basic Training"
              className="mx-auto h-auto w-full rounded-2xl"
              loading="eager"
            />
          </div>
        </div>

      </div>
    </header>
  );
};

export default HeroSection;
