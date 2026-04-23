import { ArrowRight, Bed, CalendarClock, Footprints, Home, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { dog1, dog2, dog3, dog4 } from "@/assets/dogs";

const services = [
  {
    icon: Footprints,
    title: "Solo Walk",
    desc: "A structured one-on-one walk designed for dogs who need extra focus, calmer handling, or support with behavioural challenges. Each outing is tailored to your dog’s pace, triggers, and goals, with training woven in so they get purposeful exercise and better habits at the same time.",
    price: "$30",
    unit: "/ 30 min",
    slug: "solo-walk",
    accent: "bg-accent text-accent-foreground",
    dog: dog1,
  },
  {
    icon: Users,
    title: "Group Walk",
    desc: "A thoughtfully managed social walk for dogs who enjoy the company of others and do well in a balanced group setting. Your dog gets dependable exercise, safe pack structure, and positive social exposure in a calm, professional environment.",
    price: "$30",
    unit: "/ 60 min",
    slug: "group-walk",
    accent: "bg-secondary text-secondary-foreground",
    dog: dog2,
  },
  {
    icon: Home,
    title: "Pet Sitting",
    desc: "Attentive in-home care that keeps your pet comfortable in their own space and routine. Visits include feeding, potty breaks, companionship, play, and thoughtful check-ins, so your pet feels settled and cared for while you’re away.",
    price: "$30",
    unit: "/ visit",
    slug: "sitting",
    accent: "bg-electric text-electric-foreground",
    dog: dog3,
  },
  {
    icon: Bed,
    title: "Boarding",
    desc: "Overnight care in a calm, home-based setting where your dog receives structure, close attention, and a genuine sense of comfort. It’s a more personal alternative to a standard kennel, with care that feels safe, consistent, and high quality from start to finish.",
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
    title: "Care that fits real life",
    text: "From focused solo walks to social group outings and dependable drop-in visits, every service is built to make your week feel lighter.",
  },
  {
    icon: Users,
    title: "Personal, trusted attention",
    text: "Your dog gets thoughtful care, familiar handling, and the kind of consistency that helps them feel safe, settled, and genuinely looked after.",
  },
  {
    icon: Footprints,
    title: "Peace of mind for you",
    text: "Clear communication, reliable scheduling, and a calm professional approach mean you can head into the day knowing your dog is in good hands.",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="relative bg-background py-12 sm:py-16 md:py-22">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-halftone-light opacity-60" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-tag text-clay">Services</span>
            <h2 className="mt-3 font-display text-[2.2rem] leading-[0.95] text-primary sm:text-[2.8rem] md:text-[3.5rem]">
              Choose the kind of care
              <br />
              your dog <span className="underline-accent">actually needs.</span>
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-foreground/75">
            Service-specific timing, approval steps, and clearer fee rules make the booking flow much easier for both sides.
          </p>
        </div>

        <div className="mt-8 grid gap-4 border-y-2 border-primary/20 py-5 lg:grid-cols-3">
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

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {services.map(({ icon: Icon, title, desc, price, unit, slug, accent, dog }, i) => (
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
              <div className="mt-6 flex items-baseline gap-1.5 border-t border-border pt-4">
                <span className="font-display text-3xl text-primary">{price}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
              <Link to={`/book?service=${slug}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-tag text-clay transition-colors hover:text-clay/80">
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
