import HeroSection from "@/components/HeroSection";
import MeetSitter from "@/components/MeetSitter";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import SiteFooter from "@/components/SiteFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Yo Dawg",
  description:
    "Trusted local dog walking, pet sitting, boarding and basic training. Yo Dawg — for every kind of good boy (and girl).",
  url: "https://yodawg.ca/",
  image: "https://yodawg.ca/favicon.png",
  telephone: "",
  priceRange: "$$",
  areaServed: { "@type": "City", name: "Toronto" },
  address: { "@type": "PostalAddress", addressCountry: "CA", addressRegion: "ON" },
  sameAs: [],
  makesOffer: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Dog walking" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Pet sitting" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Boarding" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Basic training" } },
  ],
};

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <SeoJsonLd id="local-business" data={localBusinessSchema} />
      <HeroSection />
      <MeetSitter />
      <ServicesSection />
      <TestimonialsSection />
      <SiteFooter />
    </main>
  );
};

export default Index;
