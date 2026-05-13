import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, PawPrint, Stethoscope, Phone, AlertTriangle, KeyRound, Heart, ShieldCheck, MessageSquare, CheckCircle2, XCircle, Circle, Trash2 } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageComposer } from "@/components/sitter/MessageComposer";
import { setPetServiceFit } from "@/lib/approveBooking";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm text-foreground"}>{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="border-b border-border/60 py-2 last:border-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

export default function SitterPetProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<Record<string, { status: string; notes: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id || !user?.id) return;
    let cancelled = false;
    (async () => {
      const [petRes, tagsRes, bookingsRes, alertsRes, servicesRes, approvalsRes] = await Promise.all([
        supabase.from("pets").select("*").eq("id", id).maybeSingle(),
        supabase.from("pet_tag_assignments").select("tag:tag_id(label, slug, visibility)").eq("pet_id", id),
        supabase.from("bookings")
          .select("id, start_at, status, services(name)")
          .eq("sitter_id", user.id).eq("pet_id", id)
          .order("start_at", { ascending: false }).limit(20),
        supabase.from("pet_fit_alerts").select("*").eq("pet_id", id).order("created_at", { ascending: false }),
        supabase.from("services").select("id, name, slug").eq("is_active", true).order("name"),
        supabase.from("sitter_pet_approvals").select("service_id, status, notes").eq("sitter_id", user.id).eq("pet_id", id),
      ]);
      if (cancelled) return;

      // pets.owner_id has no FK to profiles, so fetch the owner profile separately
      let ownerProfile: any = null;
      if (petRes.data?.owner_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, phone, mobile_phone, sms_opt_in")
          .eq("id", petRes.data.owner_id)
          .maybeSingle();
        ownerProfile = prof ?? null;
      }
      setPet(petRes.data ? { ...petRes.data, profiles: ownerProfile } : null);
      setTags(tagsRes.data ?? []);
      setBookings(bookingsRes.data ?? []);
      setAlerts(alertsRes.data ?? []);
      setServices(servicesRes.data ?? []);
      const map: Record<string, { status: string; notes: string | null }> = {};
      (approvalsRes.data ?? []).forEach((a: any) => { map[a.service_id] = { status: a.status, notes: a.notes }; });
      setApprovals(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const updateFit = async (serviceId: string, status: "approved" | "declined" | "pending") => {
    if (!user?.id || !id) return;
    setSavingId(serviceId);
    const r = await setPetServiceFit(user.id, id, serviceId, status);
    setSavingId(null);
    if (!r.ok) {
      toast.error(r.error ?? "Couldn't save");
      return;
    }
    setApprovals((prev) => ({ ...prev, [serviceId]: { status, notes: prev[serviceId]?.notes ?? null } }));
    toast.success(`Marked ${status}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await supabase.from("pets").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Couldn't delete pet");
      return;
    }
    toast.success("Pet deleted");
    setConfirmDelete(false);
    navigate("/sitter/pets");
  };

  if (loading) return <SitterShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></SitterShell>;
  if (!pet) return <SitterShell><EmptyState title="Pet not found" /></SitterShell>;

  const activeAlerts = alerts.filter((a) => !a.is_resolved);
  const owner = pet.profiles ?? {};

  return (
    <SitterShell action={
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
          <MessageSquare className="mr-1.5 h-4 w-4" />Message owner
        </Button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-1.5 h-4 w-4" />Delete pet
        </Button>
      </div>
    }>
      <Link to="/sitter/pets" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Back to pets
      </Link>

      <Card className="mb-4 flex flex-wrap items-center gap-4 border border-border p-5 shadow-soft">
        <Avatar className="h-20 w-20">
          <AvatarImage src={pet.photo_url ?? undefined} />
          <AvatarFallback><PawPrint className="h-8 w-8" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-primary">{pet.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[pet.breed ?? pet.species, pet.sex, pet.age_years ? `${pet.age_years}y` : null, pet.weight_lbs ? `${pet.weight_lbs}lb` : null, pet.color]
              .filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pet.spayed_neutered && <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" />Spayed/neutered</Badge>}
            {tags.map((t, i) => <Badge key={i} variant="outline">{t.tag?.label}</Badge>)}
          </div>
        </div>
        {owner.id && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/sitter/clients/${owner.id}`}>View owner</Link>
          </Button>
        )}
      </Card>

      {activeAlerts.length > 0 && (
        <Card className="mb-4 border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="font-display text-sm">Active fit alerts</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {activeAlerts.map((a) => <li key={a.id}>• {a.title} — {a.message}</li>)}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg text-primary"><Phone className="h-4 w-4" />Owner & contacts</h3>
          <dl>
            <Field label="Owner" value={owner.full_name} />
            <Field label="Phone" value={owner.phone} />
            <Field label="Mobile" value={owner.mobile_phone} />
            <Field label="Pet owner phone" value={pet.owner_phone} />
            <Field label="Secondary contact" value={pet.secondary_contact_name} />
            <Field label="Secondary phone" value={pet.secondary_contact_phone} />
            <Field label="Authorized pickup" value={pet.authorized_pickup_name} />
            <Field label="Pickup phone" value={pet.authorized_pickup_phone} />
            <Field label="Emergency contact" value={pet.emergency_contact} />
          </dl>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg text-primary"><Stethoscope className="h-4 w-4" />Vet & medical</h3>
          <dl>
            <Field label="Vet" value={pet.vet_name} />
            <Field label="Vet phone" value={pet.vet_phone} />
            <Field label="Vet address" value={pet.vet_address} />
            <Field label="Microchip" value={pet.microchip_id} mono />
            <Field label="Insurance" value={pet.insurance_provider} />
            <Field label="Policy #" value={pet.insurance_policy} mono />
          </dl>
          <div className="mt-3 space-y-1">
            <Block label="Medications" value={pet.medications} />
            <Block label="Allergies" value={pet.allergies} />
            <Block label="Vet notes" value={pet.vet_info} />
          </div>
        </Card>

        <Card className="border border-border p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg text-primary"><Heart className="h-4 w-4" />Behaviour & care</h3>
          <div className="space-y-1">
            <Block label="Temperament" value={pet.temperament_notes} />
            <Block label="Behavioural notes" value={pet.behavioral_notes} />
            <Block label="Dietary needs" value={pet.dietary_notes} />
            <Block label="General notes" value={pet.notes} />
          </div>
        </Card>

        {(pet.entry_instructions || pet.entry_code) && (
          <Card className="border border-border p-5 shadow-soft lg:col-span-2">
            <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg text-primary"><KeyRound className="h-4 w-4" />Entry & access</h3>
            {pet.entry_code && <p className="text-sm"><span className="text-muted-foreground">Code: </span><span className="font-mono">{pet.entry_code}</span></p>}
            {pet.entry_instructions && <p className="mt-2 whitespace-pre-wrap text-sm">{pet.entry_instructions}</p>}
          </Card>
        )}

        <Card className="border border-border p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-1 inline-flex items-center gap-2 font-display text-lg text-primary">
            <ShieldCheck className="h-4 w-4" />Pet fit decisions
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Approve or decline {pet.name} for each service. Declined services won't allow new bookings.
          </p>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active services.</p>
          ) : (
            <ul className="divide-y divide-border">
              {services.map((s) => {
                const current = approvals[s.id]?.status ?? "pending";
                const isSaving = savingId === s.id;
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          current === "approved" && "border-emerald-300 bg-emerald-50 text-emerald-900",
                          current === "declined" && "border-red-300 bg-red-50 text-red-900",
                        )}
                      >
                        {current}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={current === "approved" ? "default" : "outline"}
                        disabled={isSaving}
                        onClick={() => updateFit(s.id, "approved")}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant={current === "declined" ? "destructive" : "outline"}
                        disabled={isSaving}
                        onClick={() => updateFit(s.id, "declined")}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />Decline
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSaving || current === "pending"}
                        onClick={() => updateFit(s.id, "pending")}
                        title="Reset to pending"
                      >
                        <Circle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="border border-border p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-3 font-display text-lg text-primary">Recent bookings</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span>{b.services?.name} · {format(new Date(b.start_at), "MMM d, yyyy")}</span>
                  <Badge variant="outline" className="capitalize">{b.status.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MessageComposer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        initialCustomerId={owner.id}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pet.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pet.name}'s profile and care details. Past bookings will be kept on record but will no longer be linked to this pet. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete pet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SitterShell>
  );
}
