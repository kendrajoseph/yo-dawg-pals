import { Footprints, Home, Bed, GraduationCap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  {
    icon: Footprints,
    title: "Dog Walking",
    desc: "Solo or small-buddy walks around your neighbourhood — rain, snow or sunshine.",
    price: "$20",
    unit: "/ 30 min",
    slug: "walk",
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Drop-in visits for feeding, playtime, cuddles and a proper potty break.",
    price: "$25",
    unit: "/ visit",
    slug: "sitting",
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight stays in a calm, dog-friendly home while you're away.",
    price: "$55",
    unit: "/ night",
    slug: "boarding",
  },
  {
    icon: GraduationCap,
    title: "Training",
    desc: "Sit, stay, leash manners and house rules — positive reinforcement only.",
    price: "$40",
    unit: "/ session",
    slug: "training",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-muted/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-tag text-muted-foreground">What we do</span>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] text-primary sm:text-5xl">
            Care that fits the way
            <br />
            you and your dog <span className="italic text-accent">actually live.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/75">
            Pick a service, book a time, get back to your day. Every visit is
            handled by the same trusted sitter — no rotating staff, no guesswork.
          </p>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ icon: Icon, title, desc, price, unit, slug }) => (
            <article
              key={title}
              className="group relative flex flex-col bg-card p-7 transition-colors hover:bg-card/70"
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-full bg-primary/5 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl text-primary">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{desc}</p>
              <div className="mt-6 flex items-baseline gap-1.5 border-t border-border pt-4">
                <span className="font-display text-2xl text-primary">{price}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
              <Link
                to={`/book?service=${slug}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-tag text-accent transition-colors hover:text-accent/80"
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
