import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetForm from "@/components/pets/PetForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Pet, PetFormValues, emptyPetForm, petSchema, petToForm } from "@/lib/petSchema";
import { AlertTriangle, KeyRound, PawPrint, Pencil, Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type TemperamentTag = {
  id: string;
  label: string;
  description: string | null;
};

type PetProfilesManagerProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

const PetProfilesManager = ({
  eyebrow = "the pack",
  title = "Pet profiles.",
  description = "Build a complete profile for each pet — meds, vet, contacts, entry details. Your sitter sees everything they need, nothing they don't.",
  emptyTitle = "no pets yet",
  emptyDescription = "Add a pet so we know who we're hanging with.",
  className,
}: PetProfilesManagerProps) => {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | null>(null);
  const [form, setForm] = useState<PetFormValues>(emptyPetForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [temperamentTags, setTemperamentTags] = useState<TemperamentTag[]>([]);
  const [detailPet, setDetailPet] = useState<Pet | null>(null);

  const load = async () => {
    if (!user) return;

    const [{ data: petRows }, { data: tagRows }] = await Promise.all([
      supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: true }),
      supabase
        .from("pet_temperament_tags")
        .select("id, label, description")
        .eq("visibility", "owner")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    const petsWithBaseData = (petRows ?? []) as Pet[];
    const { data: assignmentRows } = petsWithBaseData.length
      ? await supabase
          .from("pet_tag_assignments")
          .select("pet_id, tag_id")
          .in("pet_id", petsWithBaseData.map((pet) => pet.id))
      : { data: [] };

    const assignmentsByPet = ((assignmentRows ?? []) as Array<{ pet_id: string; tag_id: string }>).reduce<Record<string, string[]>>(
      (acc, row) => {
        acc[row.pet_id] = [...(acc[row.pet_id] ?? []), row.tag_id];
        return acc;
      },
      {},
    );

    setPets(petsWithBaseData.map((pet) => ({ ...pet, temperament_tag_ids: assignmentsByPet[pet.id] ?? [] })));
    setTemperamentTags((tagRows ?? []) as TemperamentTag[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyPetForm);
    setPhotoFile(null);
    setOpen(true);
  };

  const openEdit = (pet: Pet) => {
    setEditing(pet);
    setForm(petToForm(pet));
    setPhotoFile(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = petSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the pet profile fields");
      return;
    }

    setSaving(true);
    let photo_url: string | null | undefined = undefined;

    if (photoFile) {
      const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("pets").upload(path, photoFile, {
        contentType: photoFile.type,
        upsert: false,
      });

      if (uploadError) {
        toast.error(`Photo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      photo_url = supabase.storage.from("pets").getPublicUrl(path).data.publicUrl;
    }

    const data = parsed.data;
    const str = (value?: string) => (value && value.trim() ? value.trim() : null);
    const num = (value: unknown) => (Number.isFinite(value as number) ? (value as number) : null);

    const payload = {
      name: data.name,
      species: data.species,
      breed: str(data.breed),
      sex: str(data.sex),
      color: str(data.color),
      age_years: num(data.age_years),
      weight_lbs: num(data.weight_lbs),
      microchip_id: str(data.microchip_id),
      spayed_neutered: data.spayed_neutered ?? false,
      medications: str(data.medications),
      allergies: str(data.allergies),
      dietary_notes: str(data.dietary_notes),
      behavioral_notes: str(data.behavioral_notes),
      notes: str(data.notes),
      vet_name: str(data.vet_name),
      vet_phone: str(data.vet_phone),
      vet_address: str(data.vet_address),
      vet_info: str(data.vet_info),
      owner_phone: str(data.owner_phone),
      emergency_contact: str(data.emergency_contact),
      secondary_contact_name: str(data.secondary_contact_name),
      secondary_contact_phone: str(data.secondary_contact_phone),
      authorized_pickup_name: str(data.authorized_pickup_name),
      authorized_pickup_phone: str(data.authorized_pickup_phone),
      entry_code: str(data.entry_code),
      entry_instructions: str(data.entry_instructions),
      insurance_provider: str(data.insurance_provider),
      insurance_policy: str(data.insurance_policy),
      temperament_notes: str(data.temperament_notes),
      ...(photo_url !== undefined ? { photo_url } : {}),
    };

    if (editing) {
      const { error } = await supabase.from("pets").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(`Save failed: ${error.message}`);
        setSaving(false);
        return;
      }

      await supabase.from("pet_tag_assignments").delete().eq("pet_id", editing.id);
      if (data.temperament_tag_ids.length > 0) {
        await supabase.from("pet_tag_assignments").insert(
          data.temperament_tag_ids.map((tagId) => ({ pet_id: editing.id, tag_id: tagId, created_by: user.id })),
        );
      }

      toast.success(`${payload.name} updated`);
    } else {
      const { data: insertedPet, error } = await supabase.from("pets").insert({ ...payload, owner_id: user.id }).select("id").single();
      if (error || !insertedPet) {
        toast.error(`Save failed: ${error?.message ?? "Unable to create pet profile"}`);
        setSaving(false);
        return;
      }

      if (data.temperament_tag_ids.length > 0) {
        await supabase.from("pet_tag_assignments").insert(
          data.temperament_tag_ids.map((tagId) => ({ pet_id: insertedPet.id, tag_id: tagId, created_by: user.id })),
        );
      }

      toast.success(`${payload.name} added to the pack 🐾`);
    }

    setOpen(false);
    setSaving(false);
    load();
  };

  const remove = async (pet: Pet) => {
    if (!confirm(`Remove ${pet.name}? This won't delete past bookings.`)) return;

    const { error } = await supabase.from("pets").delete().eq("id", pet.id);
    if (error) {
      toast.error(`Couldn't delete: ${error.message}`);
      return;
    }

    toast.success(`${pet.name} removed`);
    load();
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-tag text-2xl text-clay">{eyebrow}</span>
          <h2 className="font-display text-4xl text-primary sm:text-5xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
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
          <p className="mt-3 font-tag text-2xl text-clay">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
          <Button onClick={openNew} className="mt-6 font-display uppercase shadow-pop-accent">
            <Plus className="h-4 w-4" /> Add your first pet
          </Button>
        </Card>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet, index) => (
            <article
              key={pet.id}
              className={`relative border-4 border-primary bg-card p-4 shadow-pop ${index % 2 ? "rotate-1" : "-rotate-1"}`}
            >
              <button
                type="button"
                onClick={() => setDetailPet(pet)}
                className="block aspect-square w-full overflow-hidden border-2 border-primary bg-muted transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`See ${pet.name}'s full profile`}
              >
                {pet.photo_url ? (
                  <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <PawPrint className="h-12 w-12 text-foreground/30" />
                  </div>
                )}
              </button>
              <div className="mt-3">
                <h3 className="font-display text-2xl uppercase leading-tight">{pet.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {[pet.breed, pet.sex, pet.age_years ? `${pet.age_years} yr` : null, pet.weight_lbs ? `${pet.weight_lbs} lb` : null]
                    .filter(Boolean)
                    .join(" · ") || pet.species}
                </p>
              </div>

              {(pet.temperament_tag_ids ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pet.temperament_tag_ids
                    ?.map((tagId) => temperamentTags.find((tag) => tag.id === tagId)?.label)
                    .filter(Boolean)
                    .map((label) => (
                      <span key={label} className="rounded-md bg-muted px-2 py-1 text-[11px] font-tag text-primary ring-1 ring-border">
                        {label}
                      </span>
                    ))}
                </div>
              )}

              <ul className="mt-3 space-y-1 text-xs">
                {pet.medications && (
                  <li className="flex items-start gap-1.5">
                    <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay" />
                    <span className="line-clamp-1">{pet.medications}</span>
                  </li>
                )}
                {pet.allergies && (
                  <li className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="line-clamp-1">{pet.allergies}</span>
                  </li>
                )}
                {pet.entry_code && (
                  <li className="flex items-start gap-1.5">
                    <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay" />
                    <span>Entry on file</span>
                  </li>
                )}
              </ul>

              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="border-2 border-primary font-display uppercase" onClick={() => openEdit(pet)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(pet)} aria-label={`Delete ${pet.name}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-4 border-primary shadow-pop sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">{editing ? `Edit ${editing.name}` : "New pet profile"}</DialogTitle>
          </DialogHeader>
          <PetForm
            form={form}
            setForm={setForm}
            availableTemperamentTags={temperamentTags}
            photoFile={photoFile}
            setPhotoFile={setPhotoFile}
            saving={saving}
            isEdit={!!editing}
            onCancel={() => setOpen(false)}
            onSubmit={submit}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPet} onOpenChange={(o) => !o && setDetailPet(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-4 border-primary shadow-pop sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">{detailPet?.name}</DialogTitle>
          </DialogHeader>
          {detailPet && (
            <div className="space-y-5">
              {detailPet.photo_url && (
                <div className="aspect-video w-full overflow-hidden border-2 border-primary bg-muted">
                  <img src={detailPet.photo_url} alt={detailPet.name} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {detailPet.breed && <div><span className="font-tag text-xs uppercase text-muted-foreground">Breed</span><div>{detailPet.breed}</div></div>}
                {detailPet.sex && <div><span className="font-tag text-xs uppercase text-muted-foreground">Sex</span><div className="capitalize">{detailPet.sex}</div></div>}
                {detailPet.age_years != null && <div><span className="font-tag text-xs uppercase text-muted-foreground">Age</span><div>{detailPet.age_years} yr</div></div>}
                {detailPet.weight_lbs != null && <div><span className="font-tag text-xs uppercase text-muted-foreground">Weight</span><div>{detailPet.weight_lbs} lb</div></div>}
                {detailPet.color && <div><span className="font-tag text-xs uppercase text-muted-foreground">Color</span><div>{detailPet.color}</div></div>}
                {detailPet.microchip_id && <div><span className="font-tag text-xs uppercase text-muted-foreground">Microchip</span><div>{detailPet.microchip_id}</div></div>}
                <div><span className="font-tag text-xs uppercase text-muted-foreground">Spayed/neutered</span><div>{detailPet.spayed_neutered ? "Yes" : "No"}</div></div>
              </div>

              {(detailPet.temperament_tag_ids ?? []).length > 0 && (
                <div>
                  <h4 className="font-display text-sm uppercase text-primary">Temperament</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detailPet.temperament_tag_ids?.map((tagId) => {
                      const tag = temperamentTags.find((t) => t.id === tagId);
                      return tag ? <span key={tagId} className="rounded-md bg-muted px-2 py-1 text-xs font-tag text-primary ring-1 ring-border">{tag.label}</span> : null;
                    })}
                  </div>
                </div>
              )}

              {detailPet.temperament_notes && (
                <div>
                  <h4 className="font-display text-sm uppercase text-primary">Other temperament details</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{detailPet.temperament_notes}</p>
                </div>
              )}

              {[
                ["Medications", detailPet.medications],
                ["Allergies", detailPet.allergies],
                ["Diet & feeding", detailPet.dietary_notes],
                ["Behavior", detailPet.behavioral_notes],
                ["Vet", [detailPet.vet_name, detailPet.vet_phone, detailPet.vet_address].filter(Boolean).join(" · ")],
                ["Other vet info", detailPet.vet_info],
                ["Owner phone", detailPet.owner_phone],
                ["Emergency contact", detailPet.emergency_contact],
                ["Secondary contact", [detailPet.secondary_contact_name, detailPet.secondary_contact_phone].filter(Boolean).join(" · ")],
                ["Authorized pickup", [detailPet.authorized_pickup_name, detailPet.authorized_pickup_phone].filter(Boolean).join(" · ")],
                ["Door code / lockbox", detailPet.entry_code],
                ["Entry instructions", detailPet.entry_instructions],
                ["Insurance", [detailPet.insurance_provider, detailPet.insurance_policy].filter(Boolean).join(" · ")],
                ["Other notes", detailPet.notes],
              ].map(([label, value]) =>
                value ? (
                  <div key={label as string}>
                    <h4 className="font-display text-sm uppercase text-primary">{label}</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
                  </div>
                ) : null,
              )}

              <div className="flex justify-end gap-2 border-t-2 border-dashed border-primary/30 pt-4">
                <Button variant="ghost" onClick={() => setDetailPet(null)}>Close</Button>
                <Button onClick={() => { const p = detailPet; setDetailPet(null); if (p) openEdit(p); }} className="bg-primary font-display uppercase shadow-pop-accent">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PetProfilesManager;
