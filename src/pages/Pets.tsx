import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, PawPrint, Upload } from "lucide-react";

const petSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(50),
  species: z.string().trim().min(1).max(20),
  breed: z.string().trim().max(60).optional().or(z.literal("")),
  age_years: z.coerce.number().int().min(0).max(40).optional().or(z.literal(NaN)),
  weight_lbs: z.coerce.number().int().min(0).max(400).optional().or(z.literal(NaN)),
  notes: z.string().max(1000).optional().or(z.literal("")),
  vet_info: z.string().max(500).optional().or(z.literal("")),
  emergency_contact: z.string().max(200).optional().or(z.literal("")),
});

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  age_years: number | null;
  weight_lbs: number | null;
  photo_url: string | null;
  notes: string | null;
  vet_info: string | null;
  emergency_contact: string | null;
};

const emptyForm = {
  name: "", species: "dog", breed: "", age_years: "" as string | number,
  weight_lbs: "" as string | number, notes: "", vet_info: "", emergency_contact: "",
};

const Pets = () => {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: true });
    setPets((data ?? []) as Pet[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setOpen(true);
  };
  const openEdit = (p: Pet) => {
    setEditing(p);
    setForm({
      name: p.name, species: p.species, breed: p.breed ?? "",
      age_years: p.age_years ?? "", weight_lbs: p.weight_lbs ?? "",
      notes: p.notes ?? "", vet_info: p.vet_info ?? "", emergency_contact: p.emergency_contact ?? "",
    });
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

    const payload = {
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed || null,
      age_years: Number.isFinite(parsed.data.age_years as number) ? (parsed.data.age_years as number) : null,
      weight_lbs: Number.isFinite(parsed.data.weight_lbs as number) ? (parsed.data.weight_lbs as number) : null,
      notes: parsed.data.notes || null,
      vet_info: parsed.data.vet_info || null,
      emergency_contact: parsed.data.emergency_contact || null,
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
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="font-tag text-2xl text-clay">the pack</span>
            <h1 className="font-display text-5xl text-primary sm:text-6xl">My pets.</h1>
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
                <div className="mt-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-2xl uppercase leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {[p.breed, p.age_years ? `${p.age_years} yr` : null, p.weight_lbs ? `${p.weight_lbs} lb` : null]
                        .filter(Boolean).join(" · ") || p.species}
                    </p>
                  </div>
                </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-4 border-primary shadow-pop sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">{editing ? `Edit ${editing.name}` : "New pet"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name *</Label>
                <Input required value={form.name} maxLength={50} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Species</Label>
                <Input value={form.species} maxLength={20} onChange={(e) => setForm({ ...form, species: e.target.value })} />
              </div>
              <div>
                <Label>Breed</Label>
                <Input value={form.breed} maxLength={60} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
              </div>
              <div>
                <Label>Age (years)</Label>
                <Input type="number" min={0} max={40} value={form.age_years}
                  onChange={(e) => setForm({ ...form, age_years: e.target.value })} />
              </div>
              <div>
                <Label>Weight (lbs)</Label>
                <Input type="number" min={0} max={400} value={form.weight_lbs}
                  onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} />
              </div>
              <div>
                <Label>Photo</Label>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                  <Upload className="h-4 w-4" />
                  <span className="truncate">{photoFile?.name ?? "Choose image"}</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <div>
              <Label>Notes (food, quirks, allergies)</Label>
              <Textarea rows={3} maxLength={1000} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Vet info</Label>
                <Input maxLength={500} value={form.vet_info}
                  onChange={(e) => setForm({ ...form, vet_info: e.target.value })} />
              </div>
              <div>
                <Label>Emergency contact</Label>
                <Input maxLength={200} value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-primary font-display uppercase shadow-pop-accent">
                {saving ? "Saving…" : editing ? "Save" : "Add pet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </main>
  );
};

export default Pets;
