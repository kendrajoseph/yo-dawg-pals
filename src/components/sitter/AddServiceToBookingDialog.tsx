import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
type ServiceOpt = { id: string; name: string; price_cents: number; duration_minutes: number | null };

export default function AddServiceToBookingDialog({ open, onOpenChange, bookingId, customerId, onAdded }: Props) {
  const { user } = useAuth();
  const db = supabase as any;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pets, setPets] = useState<PetOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [src, setSrc] = useState<any>(null);

  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [daily, setDaily] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: b } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      setSrc(b);

      // Pets in the same request group (or just this booking's pet)
      let petIds: string[] = [];
      if (b?.request_group_id) {
        const { data: gb } = await db.from("bookings").select("pet_id").eq("request_group_id", b.request_group_id);
        petIds = Array.from(new Set((gb ?? []).map((r: any) => r.pet_id).filter(Boolean)));
      } else if (b?.pet_id) {
        petIds = [b.pet_id];
      }
      const { data: petRows } = petIds.length
        ? await db.from("pets").select("id, name, species").in("id", petIds)
        : { data: [] as any[] };
      setPets(petRows ?? []);
      setPetId(b?.pet_id ?? petRows?.[0]?.id ?? "");

      const { data: svcRows } = await db
        .from("services")
        .select("id, name, price_cents, duration_minutes")
        .eq("is_active", true)
        .neq("id", b?.service_id ?? "")
        .order("sort_order");
      setServices(svcRows ?? []);
      const defaultSvc = (svcRows ?? []).find((s: any) => /solo walk/i.test(s.name)) ?? svcRows?.[0];
      if (defaultSvc) {
        setServiceId(defaultSvc.id);
        setDuration(defaultSvc.duration_minutes ?? 30);
      }

      const start = b?.scheduled_start_at ?? b?.start_at;
      const end = b?.scheduled_end_at ?? b?.end_at;
      if (start) setStartDate(format(new Date(start), "yyyy-MM-dd"));
      if (end) setEndDate(format(new Date(end), "yyyy-MM-dd"));

      setLoading(false);
    })();
  }, [open, bookingId]);

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);

  useEffect(() => {
    if (selectedService?.duration_minutes) setDuration(selectedService.duration_minutes);
  }, [serviceId]);

  const dayCount = useMemo(() => {
    if (!daily) return 1;
    if (!startDate || !endDate) return 1;
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000)) + 1);
  }, [daily, startDate, endDate]);

  const submit = async () => {
    if (!user || !src) return;
    if (!petId || !serviceId || !startDate) {
      toast.error("Pick pet, service and date");
      return;
    }
    setSaving(true);
    try {
      // Ensure a request group
      let groupId: string | null = src.request_group_id;
      if (!groupId) {
        const { data: grp, error: ge } = await db.from("booking_request_groups").insert({
          sitter_id: src.sitter_id,
          customer_id: src.customer_id,
          status: src.status === "pending_payment" ? "requested" : "approved",
          label: src.request_group_label ?? null,
        }).select("id").single();
        if (ge) throw ge;
        groupId = grp.id;
        await db.from("bookings").update({ request_group_id: groupId, bundle_position: 0 }).eq("id", bookingId);
      }

      const { data: siblings } = await db.from("bookings").select("bundle_position").eq("request_group_id", groupId);
      let nextPos = (siblings ?? []).reduce((m: number, r: any) => Math.max(m, r.bundle_position ?? 0), 0);

      const dates: string[] = [];
      if (daily) {
        const s = parseISO(startDate);
        for (let i = 0; i < dayCount; i++) {
          dates.push(format(addDays(s, i), "yyyy-MM-dd"));
        }
      } else {
        dates.push(startDate);
      }

      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const unitPrice = selectedService?.price_cents ?? 0;

      const rows = dates.map((d) => {
        const startLocal = new Date(`${d}T${time}:00`);
        const endLocal = new Date(startLocal.getTime() + duration * 60 * 1000);
        nextPos += 1;
        return {
          customer_id: src.customer_id,
          sitter_id: src.sitter_id,
          service_id: serviceId,
          pet_id: petId,
          start_at: startLocal.toISOString(),
          end_at: endLocal.toISOString(),
          scheduled_start_at: startLocal.toISOString(),
          scheduled_end_at: endLocal.toISOString(),
          status: src.status,
          booking_kind: "instant",
          total_cents: unitPrice,
          base_price_cents: unitPrice,
          deposit_cents: 0,
          notes: notes || null,
          request_group_id: groupId,
          request_group_label: src.request_group_label,
          bundle_position: nextPos,
          terms_accepted_at: src.terms_accepted_at ?? new Date().toISOString(),
          terms_version: src.terms_version ?? "sitter-added",
          payment_status: "outstanding",
        };
      });

      const { error: insErr } = await db.from("bookings").insert(rows);
      if (insErr) throw insErr;

      toast.success(`Added ${rows.length} service ${rows.length === 1 ? "booking" : "bookings"}`);
      onAdded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add service");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add extra service</DialogTitle>
          <DialogDescription>
            Add an additional service (e.g. solo walk) for one of this client's pets. Daily mode creates one booking per day in the date range.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Pet</Label>
                <Select value={petId} onValueChange={setPetId}>
                  <SelectTrigger><SelectValue placeholder="Pick a pet" /></SelectTrigger>
                  <SelectContent>
                    {pets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm">Repeat daily</Label>
                <p className="text-xs text-muted-foreground">Create one booking per day in the date range.</p>
              </div>
              <Switch checked={daily} onCheckedChange={setDaily} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">{daily ? "Start date" : "Date"}</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              {daily && (
                <div>
                  <Label className="text-xs">End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              )}
              <div>
                <Label className="text-xs">Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Duration (min)</Label>
                <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Will create</div>
                <div className="font-medium">{dayCount} booking{dayCount === 1 ? "" : "s"}</div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || loading}>{saving ? "Adding…" : "Add service"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
