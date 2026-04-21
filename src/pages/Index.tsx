import HeroSection from "@/components/HeroSection";
import MeetSitter from "@/components/MeetSitter";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import SiteFooter from "@/components/SiteFooter";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <MeetSitter />
      <ServicesSection />
      <TestimonialsSection />
      <SiteFooter />
    </main>
  );
};

export default Index;
