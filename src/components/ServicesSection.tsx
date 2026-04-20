import { Footprints, Home, Bed, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Footprints,
    title: "Dog Walking",
    desc: "Solo or buddy walks around your neighbourhood — rain, snow or sunshine.",
    price: "from $20",
    unit: "/ 30 min walk",
    rotate: "-rotate-1",
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Drop-in visits for feeding, playtime, cuddles and a potty break.",
    price: "from $25",
    unit: "/ visit",
    rotate: "rotate-1",
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight stays in a cozy, dog-friendly home while you're away.",
    price: "from $55",
    unit: "/ night",
    rotate: "-rotate-1",
  },
  {
    icon: GraduationCap,
    title: "Basic Training",
    desc: "Sit, stay, leash manners and house rules — positive reinforcement only.",
    price: "from $40",
    unit: "/ session",
    rotate: "rotate-1",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-secondary/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/70 shadow-soft">
            🐾 Serving Hamilton, Ontario
          </span>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            What we <span className="text-gradient-sunset">do</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Pick a service, book a time, get back to your day. Easy peasy{" "}
            <span className="font-hand text-2xl text-accent">lemon squeezy.</span>
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ icon: Icon, title, desc, price, unit, rotate }) => (
            <article
              key={title}
              className={`group relative rounded-3xl border-2 border-foreground/10 bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-2 hover:rotate-0 hover:shadow-pop ${rotate}`}
            >
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-sunset text-primary-foreground shadow-soft">
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-2xl text-primary">{price}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
              <Button
                variant="ghost"
                className="mt-4 -ml-3 h-9 rounded-full px-3 text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary"
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
