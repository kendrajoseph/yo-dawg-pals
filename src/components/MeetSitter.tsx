import { Heart, ShieldCheck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import sitterPortrait from "@/assets/sitter-portrait.png";

const MeetSitter = () => {
  return (
    <section id="sitters" className="relative bg-background py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 sm:px-6 md:grid-cols-[auto,1fr] md:gap-14">
        {/* Portrait — polaroid style */}
        <div className="relative mx-auto md:mx-0">
          <div
            aria-hidden
            className="absolute -inset-3 -z-10 bg-accent/30 blur-2xl"
          />
          {/* Tape */}
          <div
            aria-hidden
            className="absolute -top-3 left-8 z-10 h-5 w-16 -rotate-12 bg-highlight/80 shadow-soft"
          />
          <div className="relative rotate-2 border-4 border-primary bg-card p-3 pb-12 shadow-pop transition-transform duration-500 hover:rotate-0">
            <img
              src={sitterPortrait}
              alt="Your friendly Yo Dawg sitter with a happy dog on a sunny walk"
              className="h-72 w-64 object-cover sm:h-80 sm:w-72"
              loading="lazy"
            />
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="font-tag text-xl text-primary">your sitter</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-2 border-2 border-primary bg-card px-3 py-1 text-xs font-display uppercase tracking-wide text-primary">
            <MapPin className="h-3.5 w-3.5" />
            Now booking locally
          </span>
          <h2 className="mt-4 font-display text-4xl leading-[0.95] text-primary sm:text-5xl">
            Meet your
            <br />
            <span className="text-gradient-spray">sitter.</span>
          </h2>
          <p className="mt-4 text-base text-foreground/85 sm:text-lg">
            Hi! I'm the human behind Yo Dawg — a lifelong dog lover offering
            personal, one-on-one walks, sits, boarding & basic training with the
            care your pup deserves. <span className="font-tag text-xl text-tag">trail-ready, treat-stocked.</span>
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
            <span className="inline-flex items-center gap-1.5 border-2 border-primary bg-secondary px-3 py-1 text-xs font-display uppercase tracking-wide text-secondary-foreground shadow-pop">
              <ShieldCheck className="h-3.5 w-3.5" /> Fully insured
            </span>
            <span className="inline-flex items-center gap-1.5 border-2 border-primary bg-tag px-3 py-1 text-xs font-display uppercase tracking-wide text-tag-foreground shadow-pop-accent">
              <Heart className="h-3.5 w-3.5" /> Pet first-aid
            </span>
            <span className="inline-flex items-center gap-1.5 border-2 border-primary bg-accent px-3 py-1 text-xs font-display uppercase tracking-wide text-accent-foreground shadow-pop-tag">
              🐾 All breeds
            </span>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Button asChild size="lg"
              className="h-12 rounded-md bg-primary px-6 font-display text-sm uppercase tracking-wide text-primary-foreground shadow-pop-accent transition-transform hover:-translate-y-0.5">
              <Link to="/book">Book a meet & greet</Link>
            </Button>
            <Button asChild size="lg" variant="outline"
              className="h-12 rounded-md border-2 border-primary bg-card px-6 font-display text-sm uppercase tracking-wide text-primary hover:bg-primary hover:text-primary-foreground">
              <Link to="/account">My account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeetSitter;
