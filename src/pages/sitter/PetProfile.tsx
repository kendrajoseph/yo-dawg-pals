import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, PawPrint, Stethoscope, Phone, AlertTriangle } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function SitterPetProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      const [petRes, tagsRes, bookingsRes, alertsRes] = await Promise.all([
        supabase.from("pets").select("*, profiles:owner_id(full_name, phone)").eq("id", id).maybeSingle(),
        supabase.from("pet_tag_assignments").select("tag:tag_id(label, slug)").eq("pet_id", id),
        supabase.from("bookings")
          .select("id, start_at, status, services(name)")
          .eq("sitter_id", user.id).eq("pet_id", id)
          .order("start_at", { ascending: false }).limit(20),
        supabase.from("pet_fit_alerts").select("*").eq("pet_id", id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setPet(petRes.data);
      setTags(tagsRes.data ?? []);
      setBookings(bookingsRes.data ?? []);
      setAlerts(alertsRes.data ?? []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (loading) return <SitterShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></SitterShell>;
  if (!pet) return <SitterShell><EmptyState title="Pet not found" /></SitterShell>;

  return (
    <SitterShell>
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
          <p className="text-sm text-muted-foreground">{pet.breed ?? pet.species}{pet.age_years ? ` · ${pet.age_years}y` : ""}{pet.weight_lbs ? ` · ${pet.weight_lbs}lb` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t, i) => <Badge key={i} variant="outline">{t.tag?.label}</Badge>)}
          </div>
        </div>
      </Card>

      {alerts.filter((a) => !a.is_resolved).length > 0 && (
        <Card className="mb-4 border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="font-display text-sm">Active fit alerts</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {alerts.filter((a) => !a.is_resolved).map((a) => (
              <li key={a.id}>• {a.title} — {a.message}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 font-display text-lg text-primary">Owner & contacts</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{pet.profiles?.full_name ?? "—"}</dd></div>
            {pet.profiles?.phone && <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{pet.profiles.phone}</dd></div>}
            {pet.emergency_contact && <div className="flex justify-between"><dt className="text-muted-foreground">Emergency</dt><dd>{pet.emergency_contact}</dd></div>}
            {pet.authorized_pickup_name && <div className="flex justify-between"><dt className="text-muted-foreground">Authorized pickup</dt><dd>{pet.authorized_pickup_name}</dd></div>}
          </dl>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg text-primary"><Stethoscope className="h-4 w-4" />Vet & medical</h3>
          <dl className="space-y-2 text-sm">
            {pet.vet_name && <div className="flex justify-between"><dt className="text-muted-foreground">Vet</dt><dd>{pet.vet_name}</dd></div>}
            {pet.vet_phone && <div className="flex justify-between"><dt className="text-muted-foreground">Vet phone</dt><dd>{pet.vet_phone}</dd></div>}
            {pet.medications && <div><dt className="text-muted-foreground">Medications</dt><dd className="mt-1">{pet.medications}</dd></div>}
            {pet.allergies && <div><dt className="text-muted-foreground">Allergies</dt><dd className="mt-1">{pet.allergies}</dd></div>}
          </dl>
        </Card>

        {(pet.entry_instructions || pet.entry_code) && (
          <Card className="border border-border p-5 shadow-soft lg:col-span-2">
            <h3 className="mb-3 font-display text-lg text-primary">Entry & access</h3>
            {pet.entry_code && <p className="text-sm"><span className="text-muted-foreground">Code: </span><span className="font-mono">{pet.entry_code}</span></p>}
            {pet.entry_instructions && <p className="mt-2 text-sm">{pet.entry_instructions}</p>}
          </Card>
        )}

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
    </SitterShell>
  );
}
