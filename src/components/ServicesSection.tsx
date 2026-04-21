import { Footprints, Home, Bed, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { dog1, dog3, dog4 } from "@/assets/dogs";

const services = [
  {
    icon: Footprints,
    title: "Dog Walking",
    desc: "Solo or small-buddy walks — basic leash manners and training cues included, rain or shine.",
    price: "$20",
    unit: "/ 30 min",
    slug: "walk",
    accent: "bg-accent text-accent-foreground",
    dog: dog1,
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Drop-in visits for feeding, playtime, cuddles and a real potty break.",
    price: "$25",
    unit: "/ visit",
    slug: "sitting",
    accent: "bg-secondary text-secondary-foreground",
    dog: dog3,
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight stays in a calm, dog-friendly home while you're away.",
    price: "$55",
    unit: "/ night",
    slug: "boarding",
    accent: "bg-clay text-clay-foreground",
    dog: dog4,
  },
];


const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-background py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-halftone-light opacity-60" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="text-xs font-tag text-clay">What we do</span>
            <h2 className="mt-3 font-display text-5xl leading-[0.95] text-primary sm:text-6xl">
              Care that fits the way
              <br />
              you and your dog{" "}
              <span className="font-serif italic text-clay">
                <span className="underline-accent">actually live.</span>
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-foreground/75">
            Pick a service, book a time, get back to your day. Same trusted
            sitter every visit — no rotating staff, no guesswork.
          </p>
        </div>




        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, desc, price, unit, slug, accent, dog }, i) => (
            <article
              key={title}
              className="group relative flex flex-col rounded-2xl border-2 border-primary bg-card p-6 pt-12 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-pop"
              style={{ transform: `rotate(${i % 2 === 0 ? "-0.6deg" : "0.6deg"})` }}
            >
              {/* floating dog mascot */}
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
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{desc}</p>
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
