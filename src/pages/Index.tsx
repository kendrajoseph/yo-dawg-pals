import HeroSection from "@/components/HeroSection";
import MeetSitter from "@/components/MeetSitter";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <MeetSitter />
      <ServicesSection />
      <TestimonialsSection />
    </main>
  );
};

export default Index;
