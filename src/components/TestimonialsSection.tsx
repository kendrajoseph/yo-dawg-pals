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
    bg: "bg-secondary/60",
  },
  {
    quote:
      "Training sessions actually stuck. My anxious shepherd now walks past squirrels like a gentleman. Magic.",
    name: "Priya & Mango",
    role: "German Shepherd mom",
    rotate: "-rotate-1",
    bg: "bg-accent/15",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reviews" className="relative bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-hand text-3xl text-accent">tail wags &amp; thank-yous</span>
          <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Loved by <span className="text-gradient-sunset">good dogs</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Real words from real Hamilton pet parents.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map(({ quote, name, role, rotate, bg }) => (
            <figure
              key={name}
              className={`group relative rounded-3xl border-2 border-foreground/10 ${bg} p-6 shadow-soft transition-all duration-300 hover:-translate-y-2 hover:rotate-0 hover:shadow-pop ${rotate}`}
            >
              <Quote
                aria-hidden
                className="absolute -top-4 left-5 h-9 w-9 rounded-full bg-gradient-sunset p-2 text-primary-foreground shadow-pop"
              />
              <div className="mb-3 flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-base leading-relaxed text-foreground/90">
                "{quote}"
              </blockquote>
              <figcaption className="mt-5 border-t border-foreground/10 pt-4">
                <div className="font-display text-lg leading-tight text-foreground">
                  {name}
                </div>
                <div className="text-xs font-medium text-muted-foreground">{role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
