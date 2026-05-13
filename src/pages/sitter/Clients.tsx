import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, UserRound, Star, Plus, PawPrint, Trash2 } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import NewClientDialog from "@/components/sitter/NewClientDialog";
import AddPetDialog from "@/components/sitter/AddPetDialog";
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
import { toast } from "@/hooks/use-toast";

type ClientRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bookings_count: number;
  star_rating: number;
  is_manual?: boolean;
};

export default function SitterClients() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [petTarget, setPetTarget] = useState<{ id: string; name: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: bookings } = await supabase
      .from("bookings")
      .select("customer_id")
      .eq("sitter_id", user.id);

    const counts = new Map<string, number>();
    for (const b of bookings ?? []) counts.set(b.customer_id, (counts.get(b.customer_id) ?? 0) + 1);

    // Manual clients created by this sitter (might have 0 bookings)
    const { data: manual } = await (supabase as any)
      .from("profiles")
      .select("id")
      .eq("created_by_sitter_id", user.id);
    for (const m of manual ?? []) if (!counts.has(m.id)) counts.set(m.id, 0);

    const ids = [...counts.keys()];
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [profilesRes, adminRes] = await Promise.all([
      (supabase as any).from("profiles").select("id, full_name, avatar_url, phone, is_manual").in("id", ids),
      supabase.from("client_admin_profiles").select("client_id, star_rating").in("client_id", ids),
    ]);
    const ratings = new Map<string, number>();
    for (const a of adminRes.data ?? []) ratings.set(a.client_id, a.star_rating);
    const out: ClientRow[] = (profilesRes.data ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      phone: p.phone,
      is_manual: p.is_manual,
      bookings_count: counts.get(p.id) ?? 0,
      star_rating: ratings.get(p.id) ?? 3,
    })).sort((a, b) => b.bookings_count - a.bookings_count);
    setRows(out);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <SitterShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">Clients</h1>
          <p className="text-sm text-muted-foreground">{rows.length} client{rows.length === 1 ? "" : "s"} you've worked with.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} size="sm"><Plus className="h-4 w-4" /> New client</Button>
      </div>

      <Card className="border border-border p-4 shadow-soft">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="pl-8" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserRound className="h-8 w-8" />} title="No clients yet" description="Add your first client with the New client button." />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link to={`/sitter/clients/${c.id}`} className="flex flex-1 items-center gap-3 px-2 py-3 transition-colors hover:bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback>{(c.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium flex items-center gap-2">
                      {c.full_name ?? "Unnamed client"}
                      {c.is_manual && <Badge variant="secondary" className="text-[10px]">manual</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.phone ?? "No phone"} · {c.bookings_count} booking{c.bookings_count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < c.star_rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setPetTarget({ id: c.id, name: c.full_name })} className="mr-1">
                  <PawPrint className="h-4 w-4" /> Pet
                </Button>
                {c.is_manual && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={c.bookings_count > 0}
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <NewClientDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => load()} />
      {petTarget && (
        <AddPetDialog
          open={!!petTarget}
          onOpenChange={(v) => { if (!v) setPetTarget(null); }}
          clientId={petTarget.id}
          clientName={petTarget.name}
          onAdded={() => load()}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this client?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.full_name ?? "Unnamed client"}" will be permanently deleted along with their pets and profile data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id);
                setDeleting(false);
                if (error) {
                  toast({ title: "Couldn't remove client", description: error.message, variant: "destructive" });
                  return;
                }
                toast({ title: "Client removed" });
                setDeleteTarget(null);
                load();
              }}
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SitterShell>
  );
}
