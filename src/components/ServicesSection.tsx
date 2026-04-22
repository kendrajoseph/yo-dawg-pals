import { ArrowRight, Bed, CalendarClock, Footprints, Home, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { dog1, dog3, dog4 } from "@/assets/dogs";

const services = [
  {
    icon: Footprints,
    title: "Solo Walk",
    desc: "Premium one-on-one walks built around your dog's pace, energy, and training needs.",
    detail: "Choose your preferred window and Anneke confirms the exact walk time.",
    price: "$28",
    unit: "/ 30 min",
    slug: "solo-walk",
    accent: "bg-accent text-accent-foreground",
    dog: dog1,
  },
  {
    icon: Users,
    title: "Group Walk",
    desc: "Small, compatibility-based walks matched thoughtfully for pace, temperament, and social fit.",
    detail: "Pick a preferred window and Anneke builds the final group and timing.",
    price: "$18",
    unit: "/ walk",
    slug: "group-walk",
    accent: "bg-secondary text-secondary-foreground",
    dog: dog1,
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Drop-in visits for feeding, playtime, cuddles, meds, and a real potty break.",
    detail: "Exact visit times are booked directly on the calendar.",
    price: "$25",
    unit: "/ visit",
    slug: "sitting",
    accent: "bg-electric text-electric-foreground",
    dog: dog3,
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight stays in a calm, dog-friendly home with consistent routines and lots of check-ins.",
    detail: "Best for dogs who do well in a home setting and like familiar people.",
    price: "$70",
    unit: "/ night",
    slug: "boarding",
    accent: "bg-clay text-clay-foreground",
    dog: dog4,
  },
];

const walkSteps = [
  {
    icon: CalendarClock,
    title: "Choose your window",
    text: "Solo walks use specific request windows. Group walks use softer windows like morning, afternoon, or evening.",
  },
  {
    icon: Users,
    title: "Anneke confirms the fit",
    text: "Group dogs are matched by pace, temperament, and compatibility so the calendar never forces the wrong mix.",
  },
  {
    icon: Footprints,
    title: "Exact timing comes after",
    text: "Solo walks are paid when requested. Group walks are only paid once Anneke approves the match and confirms the final time.",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-background py-16 sm:py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-halftone-light opacity-60" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-tag text-clay">Services</span>
            <h2 className="mt-3 font-display text-4xl leading-[0.95] text-primary sm:text-5xl md:text-6xl">
              Choose the kind of care
              <br />
              your dog <span className="underline-accent">actually needs.</span>
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-foreground/75">
            Clear options, clear pricing, and a booking flow that reflects real life — especially for walks that need judgment, not random slots.
          </p>
        </div>

        <div className="mt-10 grid gap-5 border-y-2 border-primary/20 py-6 lg:grid-cols-3">
          {walkSteps.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center border-2 border-primary bg-card text-primary shadow-pop-sm">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg uppercase text-primary">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {services.map(({ icon: Icon, title, desc, detail, price, unit, slug, accent, dog }, i) => (
            <article
              key={title}
              className="group relative flex flex-col rounded-2xl border-2 border-primary bg-card p-6 pt-12 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-pop"
              style={{ transform: `rotate(${i % 2 === 0 ? "-0.6deg" : "0.6deg"})` }}
            >
              <img
                src={dog}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-10 h-24 w-auto rotate-6 drop-shadow-[3px_3px_0_hsl(var(--primary))] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3"
              />
              <div className={`mb-5 grid h-12 w-12 place-items-center rounded-xl ${accent}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-2xl text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{desc}</p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              <div className="mt-6 flex items-baseline gap-1.5 border-t border-border pt-4">
                <span className="font-display text-3xl text-primary">{price}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
              <Link
                to={`/book?service=${slug}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-tag text-clay transition-colors hover:text-clay/80"
              >
                Book {title.toLowerCase()}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
