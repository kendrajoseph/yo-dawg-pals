import { Link } from "react-router-dom";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import PetProfilesManager from "@/components/pets/PetProfilesManager";

const Pets = () => {
  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <PetProfilesManager title="My pets." description="Build a complete profile for each pet — meds, vet, contacts, entry details. Your sitter sees everything they need, nothing they don't." />

        <Link to="/account" className="mt-10 inline-block font-tag text-clay text-xl -rotate-1">
          ← back to account
        </Link>
      </section>
      <SiteFooter />
    </main>
  );
};

export default Pets;
