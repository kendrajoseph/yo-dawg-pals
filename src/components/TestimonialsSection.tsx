import { Star } from "lucide-react";
import { dog2, dog6, dog1 } from "@/assets/dogs";

const testimonials = [
  {
    quote:
      "Our pup Biscuit comes home tired, happy and a little better behaved every single time. Genuinely the best in Hamilton.",
    name: "Maya & Biscuit",
    role: "Bernedoodle parents",
    bg: "bg-card",
    rotate: "-rotate-1",
    dog: dog2,
  },
  {
    quote:
      "Booked a last-minute weekend boarding and felt completely at ease the whole trip. Got cute photo updates too.",
    name: "Jordan",
    role: "Rescue mutt dad",
    bg: "bg-accent text-accent-foreground",
    rotate: "rotate-1",
    dog: dog6,
  },
  {
    quote:
      "Training sessions actually stuck. My anxious shepherd now walks past squirrels like a gentleman.",
    name: "Priya & Mango",
    role: "German Shepherd mom",
    bg: "bg-card",
    rotate: "-rotate-1",
    dog: dog1,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reviews" className="relative bg-muted/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-tag text-clay">Reviews</span>
          <h2 className="mt-3 font-display text-5xl leading-[0.95] text-primary sm:text-6xl">
            Loved by good dogs
            <br />
            <span className="font-serif italic text-clay">and their people.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map(({ quote, name, role, bg, rotate, dog }) => (
            <figure
              key={name}
              className={`relative flex flex-col rounded-2xl border-2 border-primary p-7 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-pop ${bg} ${rotate}`}
            >
              <img
                src={dog}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-4 -top-10 h-20 w-auto -rotate-6 drop-shadow-[3px_3px_0_hsl(var(--primary))]"
              />
              <div className="mb-4 flex gap-0.5 text-clay">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 font-serif text-lg leading-snug">
                "{quote}"
              </blockquote>
              <figcaption className="mt-6 border-t border-current/20 pt-4">
                <div className="text-sm font-semibold">{name}</div>
                <div className="mt-0.5 text-xs opacity-70">{role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
