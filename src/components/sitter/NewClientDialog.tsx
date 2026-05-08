import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: (clientId: string) => void };

export default function NewClientDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const db = supabase as any;
  const [mode, setMode] = useState<"invite" | "ghost">("ghost");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", mobile_phone: "",
    address_line1: "", address_line2: "", city: "", province: "ON", postal_code: "",
  });
  const [addPet, setAddPet] = useState(true);
  const [pet, setPet] = useState({ name: "", species: "dog", breed: "", notes: "" });

  const reset = () => {
    setForm({ full_name: "", email: "", phone: "", mobile_phone: "", address_line1: "", address_line2: "", city: "", province: "ON", postal_code: "" });
    setPet({ name: "", species: "dog", breed: "", notes: "" });
    setMode("ghost");
    setAddPet(true);
  };

  const submit = async () => {
    if (!user) return;
    if (!form.full_name.trim()) { toast.error("Name is required"); return; }
    if (mode === "invite" && !form.email.trim()) { toast.error("Email is required to invite"); return; }
    if (addPet && !pet.name.trim()) { toast.error("Pet name is required"); return; }
    setSaving(true);
    try {
      let clientId: string;
      if (mode === "invite") {
        const { data, error } = await supabase.functions.invoke("sitter-invite-client", { body: { ...form, email: form.email.trim().toLowerCase() } });
        if (error || !data?.client_id) throw new Error(error?.message ?? data?.error ?? "Invite failed");
        clientId = data.client_id;
      } else {
        // Ghost client → insert profile directly with a fresh uuid
        clientId = crypto.randomUUID();
        const { error } = await db.from("profiles").insert({
          id: clientId,
          full_name: form.full_name,
          phone: form.phone || null,
          mobile_phone: form.mobile_phone || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          province: form.province || null,
          postal_code: form.postal_code || null,
          is_manual: true,
          created_by_sitter_id: user.id,
        });
        if (error) throw error;
      }

      if (addPet) {
        const { error: petErr } = await db.from("pets").insert({
          owner_id: clientId,
          name: pet.name,
          species: pet.species || "dog",
          breed: pet.breed || null,
          notes: pet.notes || null,
          created_by_sitter_id: user.id,
        });
        if (petErr) throw petErr;
      }

      toast.success(mode === "invite" ? "Invite sent" : "Client added");
      onCreated?.(clientId);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>Add a client manually. Optionally include their first pet.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-2">
          <Label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${mode === "ghost" ? "border-primary bg-muted" : "border-border"}`}>
            <RadioGroupItem value="ghost" />
            <div><div className="font-medium text-sm">Sitter-managed</div><div className="text-xs text-muted-foreground">No login. Walk-in / cash client.</div></div>
          </Label>
          <Label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${mode === "invite" ? "border-primary bg-muted" : "border-border"}`}>
            <RadioGroupItem value="invite" />
            <div><div className="font-medium text-sm">Invite by email</div><div className="text-xs text-muted-foreground">They get a sign-in invite.</div></div>
          </Label>
        </RadioGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          {mode === "invite" && (
            <div className="sm:col-span-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          )}
          <div><Label>Mobile</Label><Input value={form.mobile_phone} onChange={(e) => setForm({ ...form, mobile_phone: e.target.value })} /></div>
          <div><Label>Other phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Address line 1</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Address line 2</Label><Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Prov</Label><Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
            <div><Label>Postal</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Add a pet now</div>
            <Switch checked={addPet} onCheckedChange={setAddPet} />
          </div>
          {addPet && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Pet name *</Label><Input value={pet.name} onChange={(e) => setPet({ ...pet, name: e.target.value })} /></div>
              <div><Label>Species</Label><Input value={pet.species} onChange={(e) => setPet({ ...pet, species: e.target.value })} placeholder="dog" /></div>
              <div className="sm:col-span-2"><Label>Breed</Label><Input value={pet.breed} onChange={(e) => setPet({ ...pet, breed: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={pet.notes} onChange={(e) => setPet({ ...pet, notes: e.target.value })} /></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : mode === "invite" ? "Send invite" : "Create client"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
