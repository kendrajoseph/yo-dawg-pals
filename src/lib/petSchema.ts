import { z } from "zod";

export const petSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  species: z.string().trim().min(1).max(20).default("dog"),
  breed: z.string().trim().max(60).optional().or(z.literal("")),
  sex: z.string().trim().max(20).optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  age_years: z.coerce.number().int().min(0).max(40).optional().or(z.literal(NaN)),
  weight_lbs: z.coerce.number().int().min(0).max(400).optional().or(z.literal(NaN)),
  microchip_id: z.string().trim().max(40).optional().or(z.literal("")),
  spayed_neutered: z.boolean().optional(),

  medications: z.string().max(1000).optional().or(z.literal("")),
  allergies: z.string().max(1000).optional().or(z.literal("")),
  dietary_notes: z.string().max(1000).optional().or(z.literal("")),
  behavioral_notes: z.string().max(1000).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),

  vet_name: z.string().trim().max(120).optional().or(z.literal("")),
  vet_phone: z.string().trim().max(40).optional().or(z.literal("")),
  vet_address: z.string().trim().max(200).optional().or(z.literal("")),
  vet_info: z.string().max(500).optional().or(z.literal("")),

  owner_phone: z.string().trim().max(40).optional().or(z.literal("")),
  emergency_contact: z.string().max(200).optional().or(z.literal("")),
  secondary_contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  secondary_contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  authorized_pickup_name: z.string().trim().max(120).optional().or(z.literal("")),
  authorized_pickup_phone: z.string().trim().max(40).optional().or(z.literal("")),

  entry_code: z.string().trim().max(40).optional().or(z.literal("")),
  entry_instructions: z.string().max(1000).optional().or(z.literal("")),

  insurance_provider: z.string().trim().max(120).optional().or(z.literal("")),
  insurance_policy: z.string().trim().max(80).optional().or(z.literal("")),

  temperament_notes: z.string().max(1000).optional().or(z.literal("")),

  temperament_tag_ids: z.array(z.string().uuid()).max(12).default([]),
});

export type PetFormValues = z.input<typeof petSchema>;

export type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  color: string | null;
  age_years: number | null;
  weight_lbs: number | null;
  microchip_id: string | null;
  spayed_neutered: boolean | null;
  photo_url: string | null;
  medications: string | null;
  allergies: string | null;
  dietary_notes: string | null;
  behavioral_notes: string | null;
  notes: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  vet_info: string | null;
  owner_phone: string | null;
  emergency_contact: string | null;
  secondary_contact_name: string | null;
  secondary_contact_phone: string | null;
  authorized_pickup_name: string | null;
  authorized_pickup_phone: string | null;
  entry_code: string | null;
  entry_instructions: string | null;
  insurance_provider: string | null;
  insurance_policy: string | null;
  temperament_notes: string | null;
  temperament_tag_ids?: string[];
};

export const emptyPetForm: PetFormValues = {
  name: "", species: "dog", breed: "", sex: "", color: "",
  age_years: "" as unknown as number, weight_lbs: "" as unknown as number,
  microchip_id: "", spayed_neutered: false,
  medications: "", allergies: "", dietary_notes: "", behavioral_notes: "", notes: "",
  vet_name: "", vet_phone: "", vet_address: "", vet_info: "",
  owner_phone: "", emergency_contact: "",
  secondary_contact_name: "", secondary_contact_phone: "",
  authorized_pickup_name: "", authorized_pickup_phone: "",
  entry_code: "", entry_instructions: "",
  insurance_provider: "", insurance_policy: "",
  temperament_notes: "",
  temperament_tag_ids: [],
};

export const petToForm = (p: Pet): PetFormValues => ({
  name: p.name,
  species: p.species,
  breed: p.breed ?? "",
  sex: p.sex ?? "",
  color: p.color ?? "",
  age_years: (p.age_years ?? "") as unknown as number,
  weight_lbs: (p.weight_lbs ?? "") as unknown as number,
  microchip_id: p.microchip_id ?? "",
  spayed_neutered: !!p.spayed_neutered,
  medications: p.medications ?? "",
  allergies: p.allergies ?? "",
  dietary_notes: p.dietary_notes ?? "",
  behavioral_notes: p.behavioral_notes ?? "",
  notes: p.notes ?? "",
  vet_name: p.vet_name ?? "",
  vet_phone: p.vet_phone ?? "",
  vet_address: p.vet_address ?? "",
  vet_info: p.vet_info ?? "",
  owner_phone: p.owner_phone ?? "",
  emergency_contact: p.emergency_contact ?? "",
  secondary_contact_name: p.secondary_contact_name ?? "",
  secondary_contact_phone: p.secondary_contact_phone ?? "",
  authorized_pickup_name: p.authorized_pickup_name ?? "",
  authorized_pickup_phone: p.authorized_pickup_phone ?? "",
  entry_code: p.entry_code ?? "",
  entry_instructions: p.entry_instructions ?? "",
  insurance_provider: p.insurance_provider ?? "",
  insurance_policy: p.insurance_policy ?? "",
  temperament_notes: p.temperament_notes ?? "",
  temperament_tag_ids: p.temperament_tag_ids ?? [],
});
