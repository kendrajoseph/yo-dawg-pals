import { Star } from "lucide-react";
import { dog2, dog6, dog1, dog5 } from "@/assets/dogs";

const testimonials = [
  {
    quote:
      "AJ is always my first choice. My Moose adores her and that makes me extra happy when he's with someone he loves.",
    name: "Natalia & Moose",
    role: "Aussie shepherd mix",
    bg: "bg-card",
    rotate: "-rotate-1",
    dog: dog2,
  },
  {
    quote:
      "AJ was kind enough to stay at our home while we were on vacation with our 6 mo old Aussie. We had been working on training and AJ kept up with it as well as improved his skills. She took wonderful care of our house too. Thank you!",
    name: "Lorie & Dexter",
    role: "Aussie shepherd parents",
    bg: "bg-accent text-accent-foreground",
    rotate: "rotate-1",
    dog: dog6,
  },
  {
    quote:
      "AJ has worked with all kinds of dogs, all with certain needs and issues. She approaches confidently while also emanating a sense of calm, making dogs want to approach her. She cares deeply for all animals and that shines through especially with rescues.",
    name: "Shaun Harnack",
    role: "Owner, Dog Hero",
    bg: "bg-card",
    rotate: "-rotate-1",
    dog: dog1,
  },
  {
    quote:
      "AJ was amazing with my 5 month old Doberman, Jax. She was super engaged with him and created a fun environment. He was having such a time and a half, he barely noticed when I got home. Will definitely be using Yo Dawg again.",
    name: "Jax's human",
    role: "5-month-old Doberman",
    bg: "bg-secondary text-secondary-foreground",
    rotate: "rotate-1",
    dog: dog5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reviews" className="relative overflow-hidden bg-muted/40 py-12 sm:py-16 md:py-22">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-tag text-clay">Kind words</span>
          <h2 className="mt-3 font-display text-[2.2rem] leading-[0.95] text-primary sm:text-[2.8rem] md:text-[3.5rem]">
            Trusted by dogs,
            <br />
            <span className="font-serif italic text-clay">appreciated by their people.</span>
          </h2>
        </div>

        <div className="mt-10 grid gap-6 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {testimonials.map(({ quote, name, role, bg, rotate, dog }) => (
            <figure
              key={name}
              className={`relative flex flex-col rounded-2xl border-2 border-primary p-6 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-pop sm:p-7 ${bg} ${rotate}`}
            >
              <img
                src={dog}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-8 h-16 w-auto -rotate-6 drop-shadow-[3px_3px_0_hsl(var(--primary))] sm:-right-4 sm:-top-10 sm:h-20"
              />
              <div className="mb-4 flex gap-0.5 text-clay">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 font-serif text-base leading-snug sm:text-lg">
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
