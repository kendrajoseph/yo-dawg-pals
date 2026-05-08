import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName?: string | null;
  onAdded?: () => void;
};

export default function AddPetDialog({ open, onOpenChange, clientId, clientName, onAdded }: Props) {
  const { user } = useAuth();
  const db = supabase as any;
  const [saving, setSaving] = useState(false);
  const [pet, setPet] = useState({ name: "", species: "dog", breed: "", notes: "" });

  const submit = async () => {
    if (!user) return;
    if (!pet.name.trim()) { toast.error("Pet name is required"); return; }
    setSaving(true);
    const { error } = await db.from("pets").insert({
      owner_id: clientId,
      name: pet.name,
      species: pet.species || "dog",
      breed: pet.breed || null,
      notes: pet.notes || null,
      created_by_sitter_id: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pet added");
    setPet({ name: "", species: "dog", breed: "", notes: "" });
    onAdded?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add pet{clientName ? ` for ${clientName}` : ""}</DialogTitle>
          <DialogDescription>Attach a pet to this client's profile.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Pet name *</Label><Input value={pet.name} onChange={(e) => setPet({ ...pet, name: e.target.value })} /></div>
          <div><Label>Species</Label><Input value={pet.species} onChange={(e) => setPet({ ...pet, species: e.target.value })} placeholder="dog" /></div>
          <div className="sm:col-span-2"><Label>Breed</Label><Input value={pet.breed} onChange={(e) => setPet({ ...pet, breed: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={pet.notes} onChange={(e) => setPet({ ...pet, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add pet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
