import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  customerId: string;
  onAdded?: () => void;
};

type PetOpt = { id: string; name: string; species: string };

export default function AddPetToBookingDialog({ open, onOpenChange, bookingId, customerId, onAdded }: Props) {
  const { user } = useAuth();
  const db = supabase as any;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availablePets, setAvailablePets] = useState<PetOpt[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [newPet, setNewPet] = useState({ name: "", species: "dog", breed: "", notes: "" });

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      // Get current booking + group
      const { data: b } = await db.from("bookings").select("request_group_id").eq("id", bookingId).maybeSingle();
      const groupId = b?.request_group_id;

      // Pets already in this group (or just this booking)
      let usedPetIds = new Set<string>();
      if (groupId) {
        const { data: groupBookings } = await db.from("bookings").select("pet_id").eq("request_group_id", groupId);
        usedPetIds = new Set((groupBookings ?? []).map((r: any) => r.pet_id));
      } else {
        const { data: cur } = await db.from("bookings").select("pet_id").eq("id", bookingId).maybeSingle();
        if (cur?.pet_id) usedPetIds.add(cur.pet_id);
      }

      const { data: pets } = await db.from("pets").select("id, name, species").eq("owner_id", customerId);
      const filtered = (pets ?? []).filter((p: any) => !usedPetIds.has(p.id));
      setAvailablePets(filtered);
      setMode(filtered.length > 0 ? "existing" : "new");
      setSelectedPetId(filtered[0]?.id ?? "");
      setLoading(false);
    })();
  }, [open, bookingId, customerId]);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Load full source booking
      const { data: src, error: srcErr } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      if (srcErr || !src) throw srcErr ?? new Error("Booking not found");

      // Determine pet id
      let petId = selectedPetId;
      if (mode === "new") {
        if (!newPet.name.trim()) { toast.error("Pet name required"); setSaving(false); return; }
        const { data: created, error: petErr } = await db.from("pets").insert({
          owner_id: customerId,
          name: newPet.name,
          species: newPet.species || "dog",
          breed: newPet.breed || null,
          notes: newPet.notes || null,
          created_by_sitter_id: user.id,
        }).select("id").single();
        if (petErr) throw petErr;
        petId = created.id;
      }
      if (!petId) { toast.error("Choose or create a pet"); setSaving(false); return; }

      // Ensure a request group exists
      let groupId: string = src.request_group_id;
      if (!groupId) {
        const { data: grp, error: grpErr } = await db.from("booking_request_groups").insert({
          sitter_id: src.sitter_id,
          customer_id: src.customer_id,
          status: src.status === "pending_payment" ? "requested" : "approved",
          label: src.request_group_label ?? null,
        }).select("id").single();
        if (grpErr) throw grpErr;
        groupId = grp.id;
        await db.from("bookings").update({ request_group_id: groupId, bundle_position: 0 }).eq("id", bookingId);
      }

      // Determine next bundle_position
      const { data: siblings } = await db.from("bookings").select("bundle_position").eq("request_group_id", groupId);
      const nextPos = (siblings ?? []).reduce((m: number, r: any) => Math.max(m, r.bundle_position ?? 0), 0) + 1;

      // Clone booking for new pet
      const newRow: any = {
        customer_id: src.customer_id,
        sitter_id: src.sitter_id,
        service_id: src.service_id,
        service_variant_id: src.service_variant_id,
        pet_id: petId,
        start_at: src.start_at,
        end_at: src.end_at,
        scheduled_start_at: src.scheduled_start_at,
        scheduled_end_at: src.scheduled_end_at,
        status: src.status,
        booking_kind: src.booking_kind,
        total_cents: src.base_price_cents ?? src.total_cents ?? 0,
        base_price_cents: src.base_price_cents,
        deposit_cents: 0,
        notes: src.notes,
        request_group_id: groupId,
        request_group_label: src.request_group_label,
        bundle_position: nextPos,
        terms_accepted_at: src.terms_accepted_at ?? new Date().toISOString(),
        terms_version: src.terms_version ?? "sitter-added",
        payment_status: "outstanding",
      };
      const { error: insErr } = await db.from("bookings").insert(newRow);
      if (insErr) throw insErr;

      toast.success("Pet added to booking");
      onAdded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add pet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add pet to booking</DialogTitle>
          <DialogDescription>
            Adds another pet to this client's booking as a sibling booking (same dates &amp; service).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="space-y-2">
              {availablePets.length > 0 && (
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="existing" id="m-existing" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="m-existing">Existing pet</Label>
                    <div className="mt-2 space-y-1">
                      {availablePets.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/30">
                          <input
                            type="radio"
                            name="petpick"
                            checked={selectedPetId === p.id}
                            onChange={() => { setSelectedPetId(p.id); setMode("existing"); }}
                          />
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground">({p.species})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <RadioGroupItem value="new" id="m-new" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="m-new">Add a new pet</Label>
                  {mode === "new" && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div><Label className="text-xs">Name *</Label><Input value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} /></div>
                      <div><Label className="text-xs">Species</Label><Input value={newPet.species} onChange={(e) => setNewPet({ ...newPet, species: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label className="text-xs">Breed</Label><Input value={newPet.breed} onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={2} value={newPet.notes} onChange={(e) => setNewPet({ ...newPet, notes: e.target.value })} /></div>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || loading}>{saving ? "Adding…" : "Add pet to booking"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
