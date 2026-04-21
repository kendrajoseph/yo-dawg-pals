import { Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "Our pup Biscuit comes home tired, happy and a little better behaved every single time. Genuinely the best in Hamilton.",
    name: "Maya & Biscuit",
    role: "Bernedoodle parents",
  },
  {
    quote:
      "Booked a last-minute weekend boarding and felt completely at ease the whole trip. Got cute photo updates too.",
    name: "Jordan",
    role: "Rescue mutt dad",
  },
  {
    quote:
      "Training sessions actually stuck. My anxious shepherd now walks past squirrels like a gentleman.",
    name: "Priya & Mango",
    role: "German Shepherd mom",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reviews" className="relative bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-tag text-muted-foreground">Reviews</span>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] text-primary sm:text-5xl">
            Loved by good dogs
            <br />
            <span className="italic text-accent">and their people.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map(({ quote, name, role }) => (
            <figure
              key={name}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft transition-shadow hover:shadow-card"
            >
              <div className="mb-4 flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 font-display text-lg leading-snug text-foreground">
                "{quote}"
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4">
                <div className="text-sm font-medium text-primary">{name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
