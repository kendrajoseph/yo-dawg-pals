import { Helmet } from "react-helmet-async";
import HeroSection from "@/components/HeroSection";
import MeetTheTeam from "@/components/MeetTheTeam";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import SiteFooter from "@/components/SiteFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Yo Dawg",
  description:
    "Trusted local dog walking, pet sitting, boarding and basic training. Yo Dawg, for every kind of good boy (and girl).",
  url: "https://yodawg.ca/",
  image: "https://yodawg.ca/og-image.jpg",
  telephone: "+1-647-278-4483",
  priceRange: "$",
  areaServed: [
    { "@type": "City", name: "Hamilton" },
    { "@type": "City", name: "Burlington" },
    { "@type": "City", name: "Dundas" },
    { "@type": "City", name: "Ancaster" },
    { "@type": "City", name: "Stoney Creek" },
    { "@type": "City", name: "Waterdown" },
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hamilton",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  sameAs: [
    "https://www.instagram.com/yodawg.ca/",
  ],
  makesOffer: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Dog walking" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Pet sitting" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Boarding" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Basic training" } },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: "3",
    bestRating: "5",
    worstRating: "1",
  },
};

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Yo Dawg — Hamilton Dog Walking, Sitting &amp; Boarding</title>
        <meta name="description" content="Hamilton, Ontario dog care since 2015. Premium solo walks, matched group walks, drop-in sitting, and home-style boarding." />
        <link rel="canonical" href="https://yodawg.ca/" />
        <meta property="og:title" content="Yo Dawg — Hamilton Dog Walking, Sitting &amp; Boarding" />
        <meta property="og:description" content="Hamilton, Ontario dog care since 2015. Premium solo walks, matched group walks, drop-in sitting, and home-style boarding." />
        <meta property="og:url" content="https://yodawg.ca/" />
        <meta property="og:type" content="website" />
      </Helmet>
      <SeoJsonLd id="local-business" data={localBusinessSchema} />
      <HeroSection />
      <MeetTheTeam />
      <ServicesSection />
      <TestimonialsSection />
      <SiteFooter />
    </main>
  );
};

export default Index;
