import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const sections = [
  {
    title: "1. Booking and approval",
    body:
      "All services are subject to availability and approval. Booking requests are not confirmed until accepted. Anneke may decline or limit service where a dog’s needs, health status, behaviour, or schedule are not a safe fit.",
  },
  {
    title: "2. Owner disclosures",
    body:
      "You agree to provide complete and current information about your dog, including medical conditions, medications, bite history, reactivity, anxiety, escape behaviour, mobility limits, and emergency contacts. You are responsible for updating this information promptly.",
  },
  {
    title: "3. Health and safety",
    body:
      "By using these services, you confirm that your dog is suitable for the selected care type and that you have disclosed any issue that could affect safety. Anneke may use reasonable judgment regarding walk routes, weather adjustments, supervision, separation from other dogs, transport, and handling.",
  },
  {
    title: "4. Veterinary care authorization",
    body:
      "If Anneke reasonably believes veterinary attention is necessary, you authorize her to seek care for your dog and to contact your listed veterinarian, emergency clinic, or emergency contact. You remain responsible for all related veterinary and emergency expenses.",
  },
  {
    title: "5. Assumption of risk and release",
    body:
      "You understand that dog walks, boarding, transport, home visits, and group interactions carry inherent risks, including illness, injury, escape, property damage, dog-to-dog incidents, and unforeseen emergencies. To the maximum extent permitted by applicable law, you voluntarily assume those risks and release Anneke, operating as Yo Dawg, from claims, losses, damages, costs, or liabilities arising from the ordinary risks of providing care, except to the extent caused by gross negligence, wilful misconduct, or any liability that cannot legally be excluded.",
  },
  {
    title: "6. Damage caused by a dog",
    body:
      "You are responsible for injury, damage, cleaning costs, veterinary costs, or third-party claims caused by your dog, including damage to people, animals, homes, vehicles, equipment, or personal property, except where prohibited by law.",
  },
  {
    title: "7. Cancellations and service changes",
    body:
      "Schedules may occasionally need to change because of illness, emergencies, weather, unsafe conditions, or other factors outside reasonable control. If a confirmed booking must be adjusted, reasonable efforts will be made to communicate promptly and offer an appropriate next step.",
  },
  {
    title: "8. Home access",
    body:
      "If you provide keys, codes, alarms, or entry instructions, you confirm they may be used for the limited purpose of delivering booked care. You are responsible for accurate access details and for securing valuables, pets, and hazards within the home.",
  },
  {
    title: "9. Agreement",
    body:
      "By booking or using Yo Dawg services, you acknowledge that you have read and agreed to these Terms & Conditions. This page is provided for operational clarity and should be reviewed with local legal counsel if you want jurisdiction-specific legal advice or stronger enforceability language.",
  },
];

const Terms = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <SiteNav variant="dark" />
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10">
          <p className="font-tag text-accent">Terms &amp; Conditions</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-none sm:text-6xl">
            Service terms, safety expectations, and liability language.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            These terms outline how care is delivered and clarify owner responsibilities, emergency authority, and release language.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <article className="mx-auto max-w-4xl space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="border-b border-border pb-8 last:border-b-0">
              <h2 className="font-display text-2xl leading-tight sm:text-3xl">{section.title}</h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {section.body}
              </p>
            </section>
          ))}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
};

export default Terms;