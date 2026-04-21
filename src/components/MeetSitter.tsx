import { useEffect, useState } from "react";
import { Heart, ShieldCheck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { dog6, dog7 } from "@/assets/dogs";
import anneke1 from "@/assets/anneke/anneke-1.jpeg";
import anneke2 from "@/assets/anneke/anneke-2.jpeg";
import anneke3 from "@/assets/anneke/anneke-3.jpeg";
import anneke4 from "@/assets/anneke/anneke-4.jpeg";
import anneke5 from "@/assets/anneke/anneke-5.jpeg";
import dogStick from "@/assets/anneke/dog-stick.jpeg";
import dogsCar from "@/assets/anneke/dogs-car.jpeg";

const carouselPhotos = [
  { src: anneke1, alt: "Anneke on a sunny walk with a golden retriever" },
  { src: anneke2, alt: "Anneke getting a big slobbery kiss from a brindle pup" },
  { src: anneke3, alt: "Anneke cuddling a happy schnauzer outdoors" },
  { src: dogStick, alt: "A very pleased Aussie shepherd guarding the world's best stick" },
  { src: anneke4, alt: "Anneke walking a chocolate lab through a golden field" },
  { src: dogsCar, alt: "Two road-trip dogs riding shotgun together" },
  { src: anneke5, alt: "Anneke and a happy dog at a glowing beach sunset" },
];

const MeetSitter = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % carouselPhotos.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="sitters" className="relative overflow-hidden bg-background py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 texture-topo opacity-40" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-[auto,1fr] md:gap-20">
        {/* Portrait carousel */}
        <div className="relative mx-auto md:mx-0">
          {/* sticker badge */}
          <div className="absolute -right-3 -top-4 z-20 grid h-20 w-20 -rotate-12 place-items-center rounded-full border-2 border-primary bg-secondary text-center font-display text-secondary-foreground shadow-pop-sm">
            <span className="text-xs leading-tight">Hi.<br />I'm Anneke</span>
          </div>
          <div className="-rotate-2 overflow-hidden rounded-3xl border-2 border-primary bg-card shadow-pop transition-transform duration-500 hover:rotate-0">
            <div className="relative h-80 w-72 sm:h-96 sm:w-80">
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
            src={dog7}
            alt=""
            aria-hidden
            className="absolute -bottom-6 -left-6 z-10 h-24 w-auto -rotate-12 drop-shadow-[4px_4px_0_hsl(var(--primary))] sm:h-28"
          />
          <img
            src={dog6}
            alt=""
            aria-hidden
            className="absolute -bottom-4 right-0 z-10 hidden h-20 w-auto rotate-6 drop-shadow-[4px_4px_0_hsl(var(--primary))] sm:block"
          />
        </div>

        {/* Bio */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-card px-3 py-1.5 text-xs font-tag text-primary shadow-pop-sm">
            <MapPin className="h-3.5 w-3.5" />
            Now booking locally
          </span>
          <h2 className="mt-5 font-display text-5xl leading-[0.95] text-primary sm:text-6xl">
            Meet your{" "}
            <span className="font-serif italic text-clay">sitter.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg">
            Hi — I'm the human behind Yo Dawg. A lifelong dog person offering
            personal, one-on-one walks, sits, boarding and basic training.
            Trail-ready, treat-stocked, slightly obsessed with your dog already.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
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

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-pop-sm transition-transform hover:-translate-y-0.5"
            >
              <Link to="/book">Book a meet & greet</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 text-sm font-semibold hover:bg-muted"
            >
              <Link to="/account">My account →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeetSitter;
