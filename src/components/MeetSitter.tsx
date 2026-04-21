import { Heart, ShieldCheck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import sitterPortrait from "@/assets/sitter-portrait.png";

const MeetSitter = () => {
  return (
    <section id="sitters" className="relative bg-background py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-[auto,1fr] md:gap-20">
        {/* Portrait */}
        <div className="relative mx-auto md:mx-0">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <img
              src={sitterPortrait}
              alt="Your friendly Yo Dawg sitter on a sunny trail walk with a happy dog"
              className="h-80 w-72 object-cover sm:h-96 sm:w-80"
              loading="lazy"
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-tag text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Now booking locally
          </span>
          <h2 className="mt-5 font-display text-4xl leading-[1.05] text-primary sm:text-5xl">
            Meet your <span className="italic text-gradient-sunrise">sitter.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg">
            Hi — I'm the human behind Yo Dawg. A lifelong dog person offering
            personal, one-on-one walks, sits, boarding and basic training, with
            the calm, attentive care your pup deserves. Trail-ready, treat-stocked.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-tag text-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" /> Fully insured
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-tag text-foreground/80">
              <Heart className="h-3.5 w-3.5 text-clay" /> Pet first-aid certified
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-tag text-foreground/80">
              All breeds welcome
            </li>
          </ul>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/book">Book a meet & greet</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 text-sm font-medium hover:bg-muted"
            >
              <Link to="/account">My account →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeetSitter;
