import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserRound, Star } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ClientRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bookings_count: number;
  star_rating: number;
};

export default function SitterClients() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("customer_id")
        .eq("sitter_id", user.id);

      const counts = new Map<string, number>();
      for (const b of bookings ?? []) {
        counts.set(b.customer_id, (counts.get(b.customer_id) ?? 0) + 1);
      }
      const ids = [...counts.keys()];
      if (ids.length === 0) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }
      const [profilesRes, adminRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, phone").in("id", ids),
        supabase.from("client_admin_profiles").select("client_id, star_rating").in("client_id", ids),
      ]);
      const ratings = new Map<string, number>();
      for (const a of adminRes.data ?? []) ratings.set(a.client_id, a.star_rating);
      const out: ClientRow[] = (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        phone: p.phone,
        bookings_count: counts.get(p.id) ?? 0,
        star_rating: ratings.get(p.id) ?? 3,
      })).sort((a, b) => b.bookings_count - a.bookings_count);
      if (!cancelled) { setRows(out); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <SitterShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Clients</h1>
        <p className="text-sm text-muted-foreground">{rows.length} client{rows.length === 1 ? "" : "s"} you've worked with.</p>
      </div>

      <Card className="border border-border p-4 shadow-soft">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="pl-8" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserRound className="h-8 w-8" />} title="No clients yet" description="Clients appear here after their first booking." />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link to={`/sitter/clients/${c.id}`} className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback>{(c.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.full_name ?? "Unnamed client"}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.phone ?? "No phone"} · {c.bookings_count} booking{c.bookings_count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < c.star_rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <Badge variant="outline">{c.bookings_count}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SitterShell>
  );
}
