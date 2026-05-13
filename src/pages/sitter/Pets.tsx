import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, PawPrint, AlertTriangle } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PetRow = {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  photo_url: string | null;
  owner_name: string | null;
};

export default function SitterPets() {
  const { user } = useAuth();
  const [pets, setPets] = useState<PetRow[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const [bookingsRes, alertsRes] = await Promise.all([
        supabase.from("bookings")
          .select("pets(id, name, breed, species, photo_url, owner_id)")
          .eq("sitter_id", user.id),
        supabase.from("pet_fit_alerts")
          .select("id, title, severity, pet_id, pets:pet_id(name)")
          .eq("is_resolved", false).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const seen = new Map<string, PetRow>();
      for (const b of (bookingsRes.data ?? []) as any[]) {
        const p = b.pets;
        if (p && !seen.has(p.id)) {
          seen.set(p.id, {
            id: p.id, name: p.name, breed: p.breed, species: p.species, photo_url: p.photo_url,
            owner_name: null,
            owner_id: p.owner_id,
          } as any);
        }
      }
      // pets.owner_id has no FK to profiles, fetch owner names separately
      const ownerIds = Array.from(new Set([...seen.values()].map((p: any) => p.owner_id).filter(Boolean)));
      if (ownerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ownerIds);
        const nameById = new Map(((profs ?? []) as any[]).map((p) => [p.id, p.full_name]));
        for (const pet of seen.values()) {
          (pet as any).owner_name = nameById.get((pet as any).owner_id) ?? null;
        }
      }
      setPets([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setAlerts(alertsRes.data ?? []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pets;
    const q = search.toLowerCase();
    return pets.filter((p) => p.name.toLowerCase().includes(q) || (p.owner_name ?? "").toLowerCase().includes(q));
  }, [pets, search]);

  return (
    <SitterShell>
      <Link to="/sitter" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Pets</h1>
        <p className="text-sm text-muted-foreground">{pets.length} pet{pets.length === 1 ? "" : "s"} across all clients.</p>
      </div>

      {alerts.length > 0 && (
        <Card className="mb-4 border border-amber-200 bg-amber-50 p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="font-display text-sm">{alerts.length} pet fit alert{alerts.length === 1 ? "" : "s"} need attention</h3>
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id}>• {a.pets?.name ?? "Pet"} — {a.title}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="border border-border p-4 shadow-soft">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pet or owner" className="pl-8" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<PawPrint className="h-8 w-8" />} title="No pets yet" description="Pets appear here after a booking is created." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link to={`/sitter/pets/${p.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={p.photo_url ?? undefined} />
                    <AvatarFallback>{p.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.breed ?? p.species} · {p.owner_name ?? "—"}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.species}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SitterShell>
  );
}
