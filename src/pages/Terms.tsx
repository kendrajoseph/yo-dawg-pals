import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const sections = [
  {
    title: "About us",
    body:
      "Yo Dawg provides dog walking, pet sitting, boarding, and basic training services in Hamilton, Ontario and surrounding areas. We can be reached at anneke@yodawg.ca or 647-278-4483.",
  },
  {
    title: "Booking and confirmation",
    body:
      "A booking is confirmed only once we have responded to you in writing (by email or text) and received any required deposit or payment.\n\nWe may decline a booking at our discretion, including if we believe a pet is not safe for us or our team to care for, if we cannot meet your scheduling needs, or for any other reason.",
  },
  {
    title: "Your responsibilities as a pet owner",
    body:
      "When you book with us, you confirm that:\n\n- You are the legal owner of the pet, or have full authority to arrange care for it\n- Your pet is up to date on rabies vaccination and other core vaccines (parvovirus, distemper, adenovirus)\n- Your pet is in good general health and free of contagious illness at the time of booking\n- You have disclosed any history of aggression, biting, behavioural issues, medical conditions, allergies, or medications\n- You have provided current emergency contact information for yourself and your veterinarian\n- You have provided safe, working access to your home if we are entering for sitting or boarding visits\n- Your pet has a properly fitted collar with current ID tag, and is licensed as required by your municipality\n\nFailure to disclose relevant information about your pet's health or behaviour may result in cancellation of services without refund, and you may be responsible for any resulting damages or veterinary costs.",
  },
  {
    title: "Our responsibilities",
    body:
      "We will:\n\n- Provide attentive, kind, and professional care for your pet\n- Follow the care instructions you provide to the best of our ability\n- Communicate with you about your pet during the booking\n- Notify you promptly of any concerns about your pet's health, behaviour, or safety\n- Treat your home and belongings with respect",
  },
  {
    title: "Payment",
    body:
      "Rates are listed on our website and confirmed at booking. Payment is due as specified in your booking confirmation. We accept e-transfer and credit card payments through our payment processor.\n\nLate payments may incur a fee of $15 per week overdue.",
  },
  {
    title: "Cancellation policy",
    body:
      "- **More than 48 hours before the booking:** full refund\n- **24 to 48 hours before the booking:** 50% refund\n- **Less than 24 hours before the booking:** no refund\n\nFor boarding bookings of three nights or more, cancellation requires 7 days notice for a full refund.\n\nCancellations by us due to illness, emergency, or weather will receive a full refund or, when possible, a rescheduled service at no extra cost.",
  },
  {
    title: "Emergencies and veterinary care",
    body:
      "If your pet requires emergency veterinary care during a booking, we will:\n\n1. Contact you immediately\n2. If we cannot reach you, contact your listed emergency contact and your veterinarian\n3. If neither is reachable and the situation is urgent, transport your pet to the nearest open veterinary clinic\n\nYou authorize us to seek emergency veterinary care on your behalf and agree to be responsible for all veterinary costs. We will not be reimbursed for transportation or our time in handling an emergency, but we will pass through any costs we pay out of pocket on your behalf.",
  },
  {
    title: "Liability",
    body:
      "Pet care involves inherent risks. Despite our best efforts, pets can become ill, injured, or distressed. Dogs may behave unpredictably even with experienced handlers.\n\nTo the fullest extent permitted by law:\n\n- We are not responsible for illness, injury, or death of a pet that occurs despite reasonable care, including but not limited to: pre-existing conditions, sudden illness, accidents, escape, fights with other animals, or acts of nature\n- We are not responsible for damage caused by your pet to your property, neighbouring property, other animals, or other people\n- Our total liability for any claim is limited to the amount you paid for the specific service in question\n- We carry pet sitter liability insurance, and our liability is limited to what that insurance covers\n\nYou agree to indemnify Yo Dawg against any claim, injury, or damage caused by your pet to a third party, including other dogs, people, or property, during the course of our services.",
  },
  {
    title: "House keys and home access",
    body:
      "If you provide us with keys, garage codes, or other home access, we will store them securely and use them only for the purpose of providing your booked services. We will return keys at the end of the service period unless you have arranged ongoing service.\n\nWe are not responsible for losses resulting from access shared with us in good faith, except where caused by our gross negligence.",
  },
  {
    title: "Photos and social media",
    body:
      "We may take photos of your pet during our services to send you updates. With your permission, we may also share photos on our social media or website. You can withdraw permission at any time.",
  },
  {
    title: "Behavioural issues",
    body:
      "If we observe behaviour that we believe makes continued care unsafe (such as aggression toward us, other animals, or people), we may end the booking early. We will contact you immediately to arrange alternative care for your pet. Refunds in these cases are at our discretion.",
  },
  {
    title: "Severe weather",
    body:
      "In cases of severe weather (extreme heat, cold, thunderstorms, ice), we may shorten walks, replace outdoor time with indoor enrichment, or reschedule visits in the interest of your pet's safety. We will communicate any adjustments with you.",
  },
  {
    title: "Changes to these terms",
    body:
      "We may update these terms from time to time. Active clients will be notified by email of material changes. Continued use of our services after notice constitutes acceptance.",
  },
  {
    title: "Governing law",
    body:
      "These terms are governed by the laws of the Province of Ontario and the laws of Canada. Any disputes will be resolved in the courts of Ontario.",
  },
  {
    title: "Contact",
    body:
      "Questions about these terms: anneke@yodawg.ca or 647-278-4483.",
  },
];

function formatBody(text: string) {
  return text.split("\n\n").map((paragraph, i) => {
    if (paragraph.startsWith("- ") || paragraph.match(/^\d+\./)) {
      // List
      const items = paragraph.split("\n").filter((l) => l.trim());
      return (
        <ul key={i} className="mt-4 space-y-2">
          {items.map((item, j) => {
            const clean = item.replace(/^[-\d.)\s]+/, "").trim();
            return (
              <li key={j} className="flex gap-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span dangerouslySetInnerHTML={{ __html: clean.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
              </li>
            );
          })}
        </ul>
      );
    }
    if (paragraph.match(/^\d+\.\s/)) {
      // Numbered steps
      const steps = paragraph.split("\n").filter((l) => l.trim());
      return (
        <ol key={i} className="mt-4 list-decimal space-y-2 pl-5">
          {steps.map((step, j) => (
            <li key={j} className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {step.replace(/^\d+\.\s/, "")}
            </li>
          ))}
        </ol>
      );
    }
    return (
      <p
        key={i}
        className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        dangerouslySetInnerHTML={{ __html: paragraph.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
      />
    );
  });
}

const Terms = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Terms of Service — Yo Dawg</title>
        <meta name="description" content="Yo Dawg service terms: booking, cancellations, owner responsibilities, emergency care, payment, and liability for dog walking, sitting, and boarding." />
        <link rel="canonical" href="https://yodawg.ca/terms" />
        <meta property="og:title" content="Terms of Service — Yo Dawg" />
        <meta property="og:description" content="Service expectations, booking policies, and liability terms for Yo Dawg dog care." />
        <meta property="og:url" content="https://yodawg.ca/terms" />
        <meta property="og:type" content="website" />
      </Helmet>
      <section className="bg-primary text-primary-foreground">
        <SiteNav variant="dark" />
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-primary-foreground/75 hover:text-primary-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <p className="font-tag text-accent">Terms of Service</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-none sm:text-6xl">
            What to expect when you book with Yo Dawg.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            Last updated: May 13, 2026. These terms govern your use of our services. By booking a service with us, you agree to these terms.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <article className="mx-auto max-w-4xl space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="border-b border-border pb-8 last:border-b-0">
              <h2 className="font-display text-2xl leading-tight sm:text-3xl">{section.title}</h2>
              {formatBody(section.body)}
            </section>
          ))}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
};

export default Terms;
