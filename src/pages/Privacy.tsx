import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const sections = [
  {
    title: "Who we are",
    body: "Yo Dawg is a dog walking, pet sitting, boarding, and basic training service operating in Hamilton, Ontario and surrounding areas. You can contact us at anneke@yodawg.ca or 647-278-4483.",
  },
  {
    title: "Information we collect",
    body: "When you book a service or contact us, we may collect:\n\n- Your name, email address, phone number, and home address\n- Your dog's name, breed, age, medical information, behavioural notes, and emergency veterinary contact\n- Service preferences, scheduling details, and special instructions\n- Payment information (processed through third-party payment providers, never stored by us directly)\n- Photos of your pet that you share with us, or that we take during our services to send you updates\n\nWe also collect basic technical information when you visit our website, such as your browser type, device, and pages viewed. We use this only to keep the site working properly.",
  },
  {
    title: "How we use your information",
    body: "We use your information to:\n\n- Provide the services you book with us\n- Communicate with you about bookings, schedule changes, and your pet's wellbeing\n- Send service updates and photos during walks or sitting visits\n- Process payments\n- Keep records for tax and accounting purposes\n- Improve our service\n\nWe do not sell your information. We do not share it with third parties for marketing.",
  },
  {
    title: "Who we share information with",
    body: "We share information only when necessary to provide our service:\n\n- Payment processors (to process your payments securely)\n- Your veterinarian or an emergency animal hospital, if your pet needs urgent care during a booking\n- Government authorities, if required by law\n\nIf we hire additional sitters in the future, your booking and pet information may be shared with the specific sitter assigned to your booking. All sitters are bound by confidentiality requirements.",
  },
  {
    title: "Photos and social media",
    body: "With your permission, we may share photos of your pet on our social media (Instagram @yodawg.ca) or website. We will always ask before posting. You can withdraw permission at any time by emailing us.",
  },
  {
    title: "How we store your information",
    body: "Your information is stored securely using industry-standard tools. We keep your records for as long as you are an active client, and for up to seven years after your last booking for accounting and tax purposes.",
  },
  {
    title: "Your rights",
    body: "Under Canadian privacy law (PIPEDA), you have the right to:\n\n- Access the information we hold about you\n- Correct any information that is wrong\n- Ask us to delete your information (subject to legal record-keeping requirements)\n- Withdraw consent for photo use or marketing communications\n\nTo exercise any of these rights, email anneke@yodawg.ca.",
  },
  {
    title: "Cookies",
    body: "Our website uses minimal cookies, only what is needed for the site to function. We do not use advertising or tracking cookies.",
  },
  {
    title: "Children",
    body: "Our services are for adults. We do not knowingly collect information from anyone under 18.",
  },
  {
    title: "Changes to this policy",
    body: "We may update this policy from time to time. The \"last updated\" date at the top will reflect the most recent change. Material changes will be communicated to active clients by email.",
  },
  {
    title: "Questions",
    body: "Email anneke@yodawg.ca or call 647-278-4483.",
  },
];

function formatBody(text: string) {
  return text.split("\n\n").map((paragraph, i) => {
    if (paragraph.startsWith("- ")) {
      const items = paragraph.split("\n").filter((l) => l.trim());
      return (
        <ul key={i} className="mt-4 space-y-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item.replace(/^-\s+/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {paragraph}
      </p>
    );
  });
}

const Privacy = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Privacy Policy — Yo Dawg</title>
        <meta name="description" content="Yo Dawg privacy policy: what information we collect, how we use it, and your rights under Canadian privacy law." />
        <link rel="canonical" href="https://yodawg.ca/privacy" />
        <meta property="og:title" content="Privacy Policy — Yo Dawg" />
        <meta property="og:description" content="How Yo Dawg collects, uses, and protects your information." />
        <meta property="og:url" content="https://yodawg.ca/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>
      <section className="bg-primary text-primary-foreground">
        <SiteNav variant="dark" />
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-primary-foreground/75 hover:text-primary-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <p className="font-tag text-accent">Privacy Policy</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-none sm:text-6xl">
            How we handle your information.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            Last updated: May 13, 2026. Yo Dawg respects your privacy. This policy explains what information we collect, how we use it, and your rights regarding your information.
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

export default Privacy;
