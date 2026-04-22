import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload } from "lucide-react";
import { PetFormValues } from "@/lib/petSchema";

type TemperamentTag = {
  id: string;
  label: string;
  description: string | null;
};

type Props = {
  form: PetFormValues;
  setForm: (v: PetFormValues) => void;
  availableTemperamentTags?: TemperamentTag[];
  photoFile: File | null;
  setPhotoFile: (f: File | null) => void;
  saving: boolean;
  isEdit: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3 border-t-2 border-dashed border-primary/30 pt-4 first:border-t-0 first:pt-0">
    <h3 className="font-display text-lg uppercase tracking-wide text-primary">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const PetForm = ({ form, setForm, availableTemperamentTags = [], photoFile, setPhotoFile, saving, isEdit, onCancel, onSubmit }: Props) => {
  const set = <K extends keyof PetFormValues>(key: K, value: PetFormValues[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Section title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *">
            <Input required value={form.name} maxLength={50} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Species">
            <Select value={form.species} onValueChange={(v) => set("species", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dog">Dog</SelectItem>
                <SelectItem value="cat">Cat</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Breed">
            <Input value={form.breed} maxLength={60} onChange={(e) => set("breed", e.target.value)} />
          </Field>
          <Field label="Sex">
            <Select value={form.sex || "unspecified"} onValueChange={(v) => set("sex", v === "unspecified" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Age (years)">
            <Input type="number" min={0} max={40} value={form.age_years as unknown as string}
              onChange={(e) => set("age_years", e.target.value as unknown as number)} />
          </Field>
          <Field label="Weight (lbs)">
            <Input type="number" min={0} max={400} value={form.weight_lbs as unknown as string}
              onChange={(e) => set("weight_lbs", e.target.value as unknown as number)} />
          </Field>
          <Field label="Color / markings">
            <Input value={form.color} maxLength={60} onChange={(e) => set("color", e.target.value)} />
          </Field>
          <Field label="Microchip ID">
            <Input value={form.microchip_id} maxLength={40} onChange={(e) => set("microchip_id", e.target.value)} />
          </Field>
          <div className="flex items-center gap-2 pt-6 sm:col-span-2">
            <Checkbox id="fixed" checked={!!form.spayed_neutered}
              onCheckedChange={(v) => set("spayed_neutered", v === true)} />
            <Label htmlFor="fixed" className="cursor-pointer">Spayed / neutered</Label>
          </div>
          <Field label="Photo">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Upload className="h-4 w-4" />
              <span className="truncate">{photoFile?.name ?? "Choose image"}</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
        </div>
      </Section>

      <Section title="Temperament tags">
        <p className="text-sm text-muted-foreground">
          Choose tags that describe how your dog typically behaves so care can be matched safely.
        </p>
        {availableTemperamentTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No temperament tags are available right now.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {availableTemperamentTags.map((tag) => {
              const checked = form.temperament_tag_ids.includes(tag.id);
              return (
                <label key={tag.id} className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      set(
                        "temperament_tag_ids",
                        next === true
                          ? [...new Set([...form.temperament_tag_ids, tag.id])]
                          : form.temperament_tag_ids.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <span>
                    <span className="block font-display text-sm uppercase text-primary">{tag.label}</span>
                    {tag.description ? <span className="mt-1 block text-xs text-muted-foreground">{tag.description}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Section>

      <Accordion type="multiple" defaultValue={["health"]} className="space-y-2">
        <AccordionItem value="health" className="border-2 border-primary/40 px-3">
          <AccordionTrigger className="font-display uppercase">Health & care</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Field label="Medications (name, dose, schedule)">
              <Textarea rows={3} maxLength={1000} value={form.medications}
                onChange={(e) => set("medications", e.target.value)} />
            </Field>
            <Field label="Allergies (food, meds, environment)">
              <Textarea rows={2} maxLength={1000} value={form.allergies}
                onChange={(e) => set("allergies", e.target.value)} />
            </Field>
            <Field label="Diet & feeding (food, amount, times)">
              <Textarea rows={3} maxLength={1000} value={form.dietary_notes}
                onChange={(e) => set("dietary_notes", e.target.value)} />
            </Field>
            <Field label="Behavior (triggers, fears, dog/cat friendly, leash habits)">
              <Textarea rows={3} maxLength={1000} value={form.behavioral_notes}
                onChange={(e) => set("behavioral_notes", e.target.value)} />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="vet" className="border-2 border-primary/40 px-3">
          <AccordionTrigger className="font-display uppercase">Veterinarian</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vet / clinic name">
                <Input value={form.vet_name} maxLength={120} onChange={(e) => set("vet_name", e.target.value)} />
              </Field>
              <Field label="Vet phone">
                <Input type="tel" value={form.vet_phone} maxLength={40} onChange={(e) => set("vet_phone", e.target.value)} />
              </Field>
            </div>
            <Field label="Vet address">
              <Input value={form.vet_address} maxLength={200} onChange={(e) => set("vet_address", e.target.value)} />
            </Field>
            <Field label="Other vet info">
              <Textarea rows={2} maxLength={500} value={form.vet_info}
                onChange={(e) => set("vet_info", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pet insurance provider">
                <Input value={form.insurance_provider} maxLength={120} onChange={(e) => set("insurance_provider", e.target.value)} />
              </Field>
              <Field label="Policy #">
                <Input value={form.insurance_policy} maxLength={80} onChange={(e) => set("insurance_policy", e.target.value)} />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="contacts" className="border-2 border-primary/40 px-3">
          <AccordionTrigger className="font-display uppercase">Contacts & pickup</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Owner phone">
                <Input type="tel" value={form.owner_phone} maxLength={40} onChange={(e) => set("owner_phone", e.target.value)} />
              </Field>
              <Field label="Emergency contact (name & phone)">
                <Input value={form.emergency_contact} maxLength={200} onChange={(e) => set("emergency_contact", e.target.value)} />
              </Field>
              <Field label="Secondary contact name">
                <Input value={form.secondary_contact_name} maxLength={120} onChange={(e) => set("secondary_contact_name", e.target.value)} />
              </Field>
              <Field label="Secondary contact phone">
                <Input type="tel" value={form.secondary_contact_phone} maxLength={40} onChange={(e) => set("secondary_contact_phone", e.target.value)} />
              </Field>
              <Field label="Authorized pickup person">
                <Input value={form.authorized_pickup_name} maxLength={120} onChange={(e) => set("authorized_pickup_name", e.target.value)} />
              </Field>
              <Field label="Authorized pickup phone">
                <Input type="tel" value={form.authorized_pickup_phone} maxLength={40} onChange={(e) => set("authorized_pickup_phone", e.target.value)} />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="entry" className="border-2 border-primary/40 px-3">
          <AccordionTrigger className="font-display uppercase">Home entry</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Field label="Door code / lockbox">
              <Input value={form.entry_code} maxLength={40} onChange={(e) => set("entry_code", e.target.value)} />
            </Field>
            <Field label="Entry instructions (alarm, key location, parking, gate, neighbors)">
              <Textarea rows={3} maxLength={1000} value={form.entry_instructions}
                onChange={(e) => set("entry_instructions", e.target.value)} />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="extra" className="border-2 border-primary/40 px-3">
          <AccordionTrigger className="font-display uppercase">Other notes</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Field label="Anything else we should know">
              <Textarea rows={4} maxLength={2000} value={form.notes}
                onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-2 border-t-2 border-dashed border-primary/30 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving} className="bg-primary font-display uppercase shadow-pop-accent">
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add pet"}
        </Button>
      </div>
    </form>
  );
};

export default PetForm;
