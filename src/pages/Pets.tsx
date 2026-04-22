import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, PawPrint, Pill, AlertTriangle, KeyRound } from "lucide-react";
import PetForm from "@/components/pets/PetForm";
import { Pet, PetFormValues, emptyPetForm, petSchema, petToForm } from "@/lib/petSchema";

const Pets = () => {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | null>(null);
  const [form, setForm] = useState<PetFormValues>(emptyPetForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("pets").select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    setPets((data ?? []) as Pet[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyPetForm);
    setPhotoFile(null);
    setOpen(true);
  };
  const openEdit = (p: Pet) => {
    setEditing(p);
    setForm(petToForm(p));
    setPhotoFile(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = petSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the fields", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);

    let photo_url: string | null | undefined = undefined;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pets").upload(path, photoFile, {
        contentType: photoFile.type,
        upsert: false,
      });
      if (upErr) {
        toast({ title: "Photo upload failed", description: upErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      photo_url = supabase.storage.from("pets").getPublicUrl(path).data.publicUrl;
    }

    const d = parsed.data;
    const str = (v?: string) => (v && v.trim() ? v.trim() : null);
    const num = (v: unknown) => (Number.isFinite(v as number) ? (v as number) : null);

    const payload = {
      name: d.name,
      species: d.species,
      breed: str(d.breed),
      sex: str(d.sex),
      color: str(d.color),
      age_years: num(d.age_years),
      weight_lbs: num(d.weight_lbs),
      microchip_id: str(d.microchip_id),
      spayed_neutered: d.spayed_neutered ?? false,
      medications: str(d.medications),
      allergies: str(d.allergies),
      dietary_notes: str(d.dietary_notes),
      behavioral_notes: str(d.behavioral_notes),
      notes: str(d.notes),
      vet_name: str(d.vet_name),
      vet_phone: str(d.vet_phone),
      vet_address: str(d.vet_address),
      vet_info: str(d.vet_info),
      owner_phone: str(d.owner_phone),
      emergency_contact: str(d.emergency_contact),
      secondary_contact_name: str(d.secondary_contact_name),
      secondary_contact_phone: str(d.secondary_contact_phone),
      authorized_pickup_name: str(d.authorized_pickup_name),
      authorized_pickup_phone: str(d.authorized_pickup_phone),
      entry_code: str(d.entry_code),
      entry_instructions: str(d.entry_instructions),
      insurance_provider: str(d.insurance_provider),
      insurance_policy: str(d.insurance_policy),
      ...(photo_url !== undefined ? { photo_url } : {}),
    };

    if (editing) {
      const { error } = await supabase.from("pets").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { toast({ title: `${payload.name} updated` }); setOpen(false); load(); }
    } else {
      const { error } = await supabase.from("pets").insert({ ...payload, owner_id: user.id });
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { toast({ title: `${payload.name} added to the pack 🐾` }); setOpen(false); load(); }
    }
    setSaving(false);
  };

  const remove = async (p: Pet) => {
    if (!confirm(`Remove ${p.name}? This won't delete past bookings.`)) return;
    const { error } = await supabase.from("pets").delete().eq("id", p.id);
    if (error) toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    else { toast({ title: `${p.name} removed` }); load(); }
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-tag text-2xl text-clay">the pack</span>
            <h1 className="font-display text-5xl text-primary sm:text-6xl">My pets.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Build a complete profile for each pet — meds, vet, contacts, entry details. Your sitter sees everything they need, nothing they don't.
            </p>
          </div>
          <Button onClick={openNew} className="bg-primary font-display uppercase shadow-pop-accent">
            <Plus className="h-4 w-4" /> Add pet
          </Button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : pets.length === 0 ? (
          <Card className="mt-8 -rotate-1 border-4 border-primary p-10 text-center shadow-pop">
            <PawPrint className="mx-auto h-10 w-10 text-clay" />
            <p className="mt-3 font-tag text-2xl text-clay">no pets yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a pet so we know who we're hanging with.</p>
            <Button onClick={openNew} className="mt-6 font-display uppercase shadow-pop-accent">
              <Plus className="h-4 w-4" /> Add your first pet
            </Button>
          </Card>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((p, i) => (
              <article
                key={p.id}
                className={`relative border-4 border-primary bg-card p-4 shadow-pop ${i % 2 ? "rotate-1" : "-rotate-1"}`}
              >
                <div className="aspect-square w-full overflow-hidden border-2 border-primary bg-muted">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <PawPrint className="h-12 w-12 text-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="font-display text-2xl uppercase leading-tight">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[p.breed, p.sex, p.age_years ? `${p.age_years} yr` : null, p.weight_lbs ? `${p.weight_lbs} lb` : null]
                      .filter(Boolean).join(" · ") || p.species}
                  </p>
                </div>

                <ul className="mt-3 space-y-1 text-xs">
                  {p.medications && (
                    <li className="flex items-start gap-1.5"><Pill className="mt-0.5 h-3.5 w-3.5 text-clay shrink-0" /><span className="line-clamp-1">{p.medications}</span></li>
                  )}
                  {p.allergies && (
                    <li className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" /><span className="line-clamp-1">{p.allergies}</span></li>
                  )}
                  {p.entry_code && (
                    <li className="flex items-start gap-1.5"><KeyRound className="mt-0.5 h-3.5 w-3.5 text-clay shrink-0" /><span>Entry on file</span></li>
                  )}
                </ul>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="border-2 border-primary font-display uppercase" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <Link to="/account" className="mt-10 inline-block font-tag text-clay text-xl -rotate-1">
          ← back to account
        </Link>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-4 border-primary shadow-pop sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">
              {editing ? `Edit ${editing.name}` : "New pet profile"}
            </DialogTitle>
          </DialogHeader>
          <PetForm
            form={form}
            setForm={setForm}
            photoFile={photoFile}
            setPhotoFile={setPhotoFile}
            saving={saving}
            isEdit={!!editing}
            onCancel={() => setOpen(false)}
            onSubmit={submit}
          />
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </main>
  );
};

export default Pets;
