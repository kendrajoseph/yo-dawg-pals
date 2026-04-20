import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "Our pup Biscuit comes home tired, happy, and a little bit better behaved every single time. Genuinely the best in Hamilton.",
    name: "Maya & Biscuit",
    role: "Bernedoodle parents",
    rotate: "-rotate-2",
    bg: "bg-card",
  },
  {
    quote:
      "Booked a last-minute weekend boarding and felt totally at ease the whole trip. Got cute photo updates too! 10/10.",
    name: "Jordan",
    role: "Rescue mutt dad",
    rotate: "rotate-1",
    bg: "bg-highlight",
  },
  {
    quote:
      "Training sessions actually stuck. My anxious shepherd now walks past squirrels like a gentleman. Magic.",
    name: "Priya & Mango",
    role: "German Shepherd mom",
    rotate: "-rotate-1",
    bg: "bg-secondary text-secondary-foreground",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reviews" className="relative bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-tag text-2xl text-clay sm:text-3xl">
            tail wags & thank-yous
          </span>
          <h2 className="mt-2 font-display text-4xl leading-[0.95] text-primary sm:text-6xl">
            Loved by
            <br />
            <span className="text-accent">good dogs.</span>
          </h2>
          <p className="mt-4 text-base text-foreground/75 sm:text-lg">
            Real words from real Hamilton pet parents.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map(({ quote, name, role, rotate, bg }) => (
            <figure
              key={name}
              className={`group relative border-4 border-primary p-6 shadow-pop transition-all duration-300 hover:-translate-y-2 hover:rotate-0 ${rotate} ${bg}`}
            >
              <Quote
                aria-hidden
                className="absolute -top-4 left-4 h-9 w-9 bg-accent p-2 text-accent-foreground"
              />
              <div className="mb-3 mt-2 flex gap-0.5 text-clay">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-base leading-relaxed">
                "{quote}"
              </blockquote>
              <figcaption className="mt-5 border-t-2 border-primary/20 pt-4">
                <div className="font-display text-lg uppercase tracking-tight">
                  {name}
                </div>
                <div className="text-xs font-medium opacity-70">{role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
