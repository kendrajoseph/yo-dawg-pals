import { Footprints, Home, Bed, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Footprints,
    title: "Dog Walking",
    desc: "Solo or buddy walks around your neighbourhood — rain, snow or sunshine.",
    price: "$20",
    unit: "/ 30 min",
    rotate: "-rotate-1",
    bg: "bg-card",
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Drop-in visits for feeding, playtime, cuddles and a potty break.",
    price: "$25",
    unit: "/ visit",
    rotate: "rotate-1",
    bg: "bg-highlight",
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight stays in a cozy, dog-friendly home while you're away.",
    price: "$55",
    unit: "/ night",
    rotate: "-rotate-1",
    bg: "bg-card",
  },
  {
    icon: GraduationCap,
    title: "Training",
    desc: "Sit, stay, leash manners and house rules — positive reinforcement only.",
    price: "$40",
    unit: "/ session",
    rotate: "rotate-1",
    bg: "bg-secondary text-secondary-foreground",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-muted py-16 sm:py-24 texture-grain">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-tag text-2xl text-clay sm:text-3xl">
            🐾 Hamilton, Ontario
          </span>
          <h2 className="mt-2 font-display text-4xl leading-[0.95] text-primary sm:text-6xl">
            What we
            <br />
            <span className="text-gradient-sunlight">do.</span>
          </h2>
          <p className="mt-4 text-base text-foreground/75 sm:text-lg">
            Pick a service, book a time, get back to your day.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ icon: Icon, title, desc, price, unit, rotate, bg }) => (
            <article
              key={title}
              className={`group relative border-4 border-primary p-5 shadow-pop transition-all duration-300 hover:-translate-y-2 hover:rotate-0 ${rotate} ${bg}`}
            >
              <div className="mb-4 grid h-12 w-12 place-items-center bg-primary text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-2xl leading-tight">{title}</h3>
              <p className="mt-2 text-sm opacity-80">{desc}</p>
              <div className="mt-4 flex items-baseline gap-1.5 border-t-2 border-primary/20 pt-3">
                <span className="font-display text-3xl text-clay">{price}</span>
                <span className="text-xs font-medium opacity-70">{unit}</span>
              </div>
              <Button
                variant="ghost"
                className="mt-3 -ml-2 h-9 px-2 font-display text-xs uppercase tracking-wide hover:bg-primary hover:text-primary-foreground"
              >
                Book {title.toLowerCase()}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
