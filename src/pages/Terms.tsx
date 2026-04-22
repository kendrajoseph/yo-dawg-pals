import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const sections = [
  {
    title: "1. Acceptance of terms",
    body:
      "By booking, requesting, or using Yo Dawg services, you agree to these Terms & Conditions as a binding agreement between you and Yo Dawg. If you do not agree, do not use the services. We may update these terms from time to time, and the version accepted at booking applies to that booking unless the law requires otherwise.",
  },
  {
    title: "2. Booking requests, approvals, and service limits",
    body:
      "All services are subject to availability, screening, and approval. A request is not confirmed until accepted and, where applicable, paid. Yo Dawg may decline, cancel, shorten, reschedule, refuse handoff, separate dogs, modify routes, or end a service early where health, safety, weather, behaviour, access issues, equipment failure, emergencies, or scheduling realities make that decision reasonably necessary.",
  },
  {
    title: "3. Owner disclosures and accuracy of information",
    body:
      "You must provide complete, truthful, and current information about your dog and household, including vaccinations where applicable, illness, injuries, medications, allergies, bite history, aggression, reactivity, anxiety, escape behaviour, mobility limits, feeding instructions, behavioural triggers, home entry details, and emergency contacts. You are solely responsible for losses or harm caused by incomplete, inaccurate, or outdated information.",
  },
  {
    title: "4. Health, behaviour, and participation standards",
    body:
      "By using these services, you represent that your dog is fit for the selected care type and can safely participate in the booked activity. Yo Dawg may use reasonable judgment regarding supervision, transport, routing, weather adjustments, grouping, gear, feeding, rest, separation, crate time, and handling. Group services are not guaranteed and may be converted, delayed, or declined if a dog is not an appropriate fit.",
  },
  {
    title: "5. Veterinary care and emergency authority",
    body:
      "If Yo Dawg reasonably believes veterinary attention, emergency transport, or urgent protective action is necessary, you authorize Yo Dawg to obtain treatment, contact your veterinarian, contact an emergency clinic, contact emergency responders, and contact your listed emergency contact. You are responsible for all related veterinary, transport, treatment, medication, and emergency costs, whether or not prior contact with you was successful.",
  },
  {
    title: "6. Assumption of risk",
    body:
      "You understand that dog walking, boarding, transport, home visits, outdoor activity, interaction with people, and interaction with other animals involve inherent and unpredictable risks, including illness, injury, stress, escape, theft, property damage, dog fights, bites, vehicle incidents, exposure to parasites or disease, and death. You voluntarily accept those risks for yourself, your dog, your household, and your property.",
  },
  {
    title: "7. Release and limitation of liability",
    body:
      "To the maximum extent permitted by law, you release Yo Dawg and its owners, operators, staff, contractors, and representatives from claims, losses, damages, liabilities, costs, and expenses arising out of or related to booked services, except to the extent directly caused by gross negligence, wilful misconduct, or liability that cannot legally be excluded. Without limiting the previous sentence, Yo Dawg is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost business, emotional distress, reputational harm, or uninsured veterinary expenses.",
  },
  {
    title: "8. Owner responsibility for dog-caused loss",
    body:
      "You remain fully responsible for injury, damage, contamination, property loss, veterinary bills, third-party claims, legal expenses, and other costs caused by your dog, including harm to people, animals, vehicles, homes, furnishings, floors, yards, leashes, crates, and other property, except where prohibited by law.",
  },
  {
    title: "9. Home access, household conditions, and property",
    body:
      "If you provide keys, codes, lockbox details, alarms, parking instructions, or entry directions, you authorize Yo Dawg to use them for the limited purpose of delivering booked care. You are responsible for working access, safe premises, secure fencing, lawful conditions, restrained hazardous animals, cleared walkways, and disclosure of hazards including aggressive animals, smoke, pests, unsafe flooring, construction, cameras, and security systems. Yo Dawg is not responsible for losses caused by faulty locks, third-party entry, or unsafe premises not created by Yo Dawg.",
  },
  {
    title: "10. Cancellations, delays, and schedule changes",
    body:
      "Schedules may change because of illness, emergencies, weather, road conditions, dog behaviour, transport issues, or other factors inside or outside reasonable control. Yo Dawg may adjust timing, walker assignment, sequence, route, grouping, or service format as reasonably needed. Cancellation, refund, credit, and rescheduling outcomes are governed by the booking terms presented at the time of booking and any separately communicated policy.",
  },
  {
    title: "11. Payments, fees, and collection",
    body:
      "You authorize Yo Dawg to charge the amounts shown or later approved for booked care, including base service charges, approved extra time, late pickup, additional care requirements, damage-related charges, and unpaid balances. If payment is overdue, Yo Dawg may pause future services and pursue lawful collection of outstanding amounts, including reasonable recovery costs where permitted.",
  },
  {
    title: "12. Photos, updates, and communication",
    body:
      "Service updates, photos, videos, notes, and messages are provided as a courtesy and are not guaranteed on any fixed schedule. Technical delays, device issues, coverage limitations, emergencies, or active handling of dogs may affect when updates are sent.",
  },
  {
    title: "13. No guarantees and force majeure",
    body:
      "Yo Dawg does not guarantee uninterrupted availability, exact time-of-day performance, specific routes, specific walkers, uninterrupted group composition, or outcomes beyond the exercise of reasonable care and judgment. Yo Dawg is not liable for delay, interruption, or nonperformance caused by events beyond reasonable control, including storms, wildfire smoke, extreme heat or cold, road closures, civil emergencies, utility failure, labour disruption, communicable disease events, government action, or platform outages.",
  },
  {
    title: "14. Governing responsibility and legal review",
    body:
      "By booking or using Yo Dawg services, you acknowledge that you have read and agreed to these Terms & Conditions. If you want province-specific or country-specific enforceability language, consumer-law tailoring, or dispute-resolution clauses, these terms should be reviewed by a qualified local lawyer before launch.",
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
            Service terms, risk allocation, and liability protections.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            These terms outline how care is delivered and clarify approvals, owner responsibilities, emergency authority, payment obligations, and liability limits.
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