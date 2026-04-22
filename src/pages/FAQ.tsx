import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "How do bookings work?",
    answer:
      "Start by submitting a booking request with your preferred service, timing, and pet details. Anneke reviews each request personally and confirms availability, fit, and any next steps before care begins.",
  },
  {
    question: "Do all dogs need to be a good fit for group walks?",
    answer:
      "Yes. Group walks are matched carefully by temperament, pace, and social comfort. If a dog is not the right fit for a group, solo care may be recommended instead.",
  },
  {
    question: "What information should I provide before care starts?",
    answer:
      "Please share feeding instructions, medications, behaviour notes, vet details, emergency contacts, home access instructions, and anything else needed to keep your dog safe and comfortable.",
  },
  {
    question: "What happens in an emergency?",
    answer:
      "If Anneke believes urgent care is required, she may contact your veterinarian, an emergency clinic, or your listed emergency contact and take reasonable steps to protect your dog’s wellbeing.",
  },
  {
    question: "Are owners still responsible for their dogs?",
    answer:
      "Yes. Owners remain responsible for accurate health and behaviour disclosures, maintaining current vaccinations where applicable, and any losses, injuries, or damage caused by their dog except where prohibited by law.",
  },
  {
    question: "Where can I review the full terms?",
    answer:
      "The full service expectations, assumptions of risk, cancellation terms, and liability language are available on the Terms & Conditions page linked in the footer.",
  },
];

const FAQ = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <SiteNav variant="dark" />
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10">
          <p className="font-tag text-accent">FAQ</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-none sm:text-6xl">
            Questions owners ask before booking care.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            Clear expectations help keep walks, sits, and boarding calm, safe, and well-matched for every dog.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Accordion type="single" collapsible className="w-full border-t border-border">
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question} className="border-border">
                <AccordionTrigger className="py-6 text-left font-display text-xl leading-snug hover:no-underline sm:text-2xl">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
};

export default FAQ;