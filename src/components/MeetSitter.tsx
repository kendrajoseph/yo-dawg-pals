import { Heart, ShieldCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import sitterPortrait from "@/assets/sitter-portrait.png";

const MeetSitter = () => {
  return (
    <section id="sitters" className="relative bg-background py-20 sm:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 md:grid-cols-[auto,1fr] md:gap-14">
        {/* Portrait */}
        <div className="relative mx-auto md:mx-0">
          <div
            aria-hidden
            className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-sunset opacity-30 blur-2xl"
          />
          <div className="relative rotate-2 overflow-hidden rounded-3xl border-2 border-foreground/10 bg-card p-3 shadow-pop transition-transform duration-500 hover:rotate-0">
            <img
              src={sitterPortrait}
              alt="Your friendly Yo Dawg sitter with a happy dog on a sunny walk"
              className="h-72 w-64 rounded-2xl object-cover sm:h-80 sm:w-72"
              loading="lazy"
            />
            {/* Sticker */}
            <div className="absolute -left-4 -top-4 grid h-20 w-20 -rotate-12 place-items-center rounded-full bg-accent text-center text-accent-foreground shadow-pop sm:h-24 sm:w-24">
              <div>
                <div className="font-hand text-sm leading-none sm:text-base">hi, I'm</div>
                <div className="font-display text-base leading-tight sm:text-lg">your sitter!</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/70 shadow-soft">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Now booking locally
          </span>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Meet your sitter
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Hi! I'm the human behind Yo Dawg — a lifelong dog lover offering personal,
            one-on-one walks, sits, boarding & basic training with the care your pup
            deserves.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Fully insured
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">
              <Heart className="h-3.5 w-3.5 text-accent" /> Pet first-aid trained
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">
              🐾 All breeds welcome
            </span>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Button
              size="lg"
              className="h-12 rounded-full bg-gradient-sunset px-6 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105 hover:shadow-pop"
            >
              Book a meet & greet
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-2 border-foreground/15 bg-card px-6 font-semibold hover:border-primary hover:text-primary"
            >
              Read my story
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeetSitter;
