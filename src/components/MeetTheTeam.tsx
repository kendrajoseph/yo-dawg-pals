import { useEffect, useState } from "react";
import { Heart, ShieldCheck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { dog4, dog8 } from "@/assets/dogs";
import anneke1 from "@/assets/anneke/anneke-1.jpeg";
import anneke2 from "@/assets/anneke/anneke-2.jpeg";
import anneke3 from "@/assets/anneke/anneke-3.jpeg";
import anneke4 from "@/assets/anneke/anneke-4.jpeg";
import anneke5 from "@/assets/anneke/anneke-5.jpeg";
import dogStick from "@/assets/anneke/dog-stick.jpeg";
import dogsCar from "@/assets/anneke/dogs-car.jpeg";

const carouselPhotos = [
  { src: anneke1, alt: "AJ on a sunny walk with a golden retriever" },
  { src: anneke2, alt: "AJ getting a big slobbery kiss from a brindle pup" },
  { src: anneke3, alt: "AJ cuddling a happy schnauzer outdoors" },
  { src: dogStick, alt: "A very pleased Aussie shepherd guarding the world's best stick" },
  { src: anneke4, alt: "AJ walking a chocolate lab through a golden field" },
  { src: dogsCar, alt: "Two road-trip dogs riding shotgun together" },
  { src: anneke5, alt: "AJ and a happy dog at a glowing beach sunset" },
];

const MeetTheTeam = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % carouselPhotos.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="sitters" className="relative overflow-hidden bg-background py-12 sm:py-16 md:py-22">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-topo opacity-40" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 sm:gap-10 sm:px-8 md:grid-cols-[auto,1fr] md:gap-14">
        {/* Portrait carousel */}
        <div className="relative mx-auto md:mx-0">
          {/* sticker badge */}
          <div className="absolute -right-2 -top-3 z-20 grid h-16 w-16 -rotate-12 place-items-center rounded-full border-2 border-primary bg-secondary text-center font-display text-secondary-foreground shadow-pop-sm sm:-right-3 sm:-top-4 sm:h-20 sm:w-20">
            <span className="text-[10px] leading-tight sm:text-xs">Hi.<br />I'm AJ</span>
          </div>
          <div className="-rotate-2 overflow-hidden rounded-3xl border-2 border-primary bg-card shadow-pop transition-transform duration-500 hover:rotate-0">
            <div className="relative h-72 w-64 sm:h-96 sm:w-80">
              {carouselPhotos.map((photo, i) => (
                <img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                    i === index ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
          </div>
          {/* dots */}
          <div className="absolute -bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {carouselPhotos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show photo ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full border border-primary transition-all ${
                  i === index ? "w-6 bg-primary" : "w-2 bg-card"
                }`}
              />
            ))}
          </div>
          {/* peeking dog buddies */}
          <img
            src={dog4}
            alt=""
            aria-hidden
            className="absolute -bottom-4 -left-3 z-10 h-20 w-auto -rotate-12 drop-shadow-[4px_4px_0_hsl(var(--primary))] sm:-bottom-6 sm:-left-6 sm:h-28"
          />
          <img
            src={dog8}
            alt=""
            aria-hidden
            className="absolute -bottom-4 right-0 z-10 hidden h-20 w-auto rotate-6 drop-shadow-[4px_4px_0_hsl(var(--primary))] sm:block"
          />
        </div>

        {/* Bio */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-card px-3 py-1.5 text-xs font-tag text-primary shadow-pop-sm">
            <MapPin className="h-3.5 w-3.5" />
            Local, personal care
          </span>
          <h2 className="mt-4 font-display text-[2.2rem] leading-[0.95] text-primary sm:text-[2.8rem] md:text-[3.5rem]">
            Meet <span className="font-serif italic text-clay">AJ.</span>
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-[1.05rem]">
            I’m the person behind every Yo Dawg walk, visit, and overnight stay. I keep things small on purpose so I can learn your dog properly, make smart group decisions, and give you care that feels consistent, calm, and personal.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-secondary px-3 py-1.5 text-xs font-tag text-secondary-foreground shadow-pop-sm">
              <ShieldCheck className="h-3.5 w-3.5" /> Fully insured
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-accent px-3 py-1.5 text-xs font-tag text-accent-foreground shadow-pop-sm">
              <Heart className="h-3.5 w-3.5" /> Pet first-aid
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-clay px-3 py-1.5 text-xs font-tag text-clay-foreground shadow-pop-sm">
              All breeds welcome
            </li>
          </ul>

          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-pop-sm transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              <Link to="/book?service=meet-and-greet">Book a meet & greet</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full rounded-full px-5 text-sm font-semibold hover:bg-muted sm:w-auto"
            >
              <Link to="/account">My account →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeetTheTeam;
