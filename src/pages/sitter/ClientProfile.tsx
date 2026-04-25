import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Mail, Phone, PawPrint, CalendarDays, CreditCard, MessageSquare } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCents } from "@/lib/invoices";

export default function SitterClientProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      const [pRes, bookingsRes, invoicesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("bookings")
          .select("id, start_at, end_at, status, total_cents, payment_status, services(name), pets(id, name, photo_url)")
          .eq("sitter_id", user.id).eq("customer_id", id)
          .order("start_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, status, total_cents, amount_paid_cents, due_date, created_at")
          .eq("sitter_id", user.id).eq("customer_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setProfile(pRes.data);
      setBookings(bookingsRes.data ?? []);
      setInvoices(invoicesRes.data ?? []);
      const seen = new Map<string, any>();
      for (const b of bookingsRes.data ?? []) {
        if (b.pets) seen.set(b.pets.id, b.pets);
      }
      setPets([...seen.values()]);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (loading) {
    return <SitterShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></SitterShell>;
  }
  if (!profile) {
    return <SitterShell><EmptyState title="Client not found" /></SitterShell>;
  }

  return (
    <SitterShell>
      <Link to="/sitter/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Back to clients
      </Link>

      <Card className="mb-4 flex flex-wrap items-center gap-4 border border-border p-5 shadow-soft">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback>{(profile.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-primary">{profile.full_name ?? "Unnamed client"}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {profile.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phone}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/sitter/messages"><MessageSquare className="mr-1.5 h-4 w-4" />Message</Link></Button>
          <Button size="sm" asChild><Link to="/sitter/invoices"><CreditCard className="mr-1.5 h-4 w-4" />New invoice</Link></Button>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pets">Pets ({pets.length})</TabsTrigger>
          <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border border-border p-5 shadow-soft">
            <h3 className="mb-3 font-display text-lg text-primary">Recent activity</h3>
            {bookings.slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {bookings.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2">
                    <span>{b.services?.name} · {format(new Date(b.start_at), "MMM d")}</span>
                    <Badge variant="outline" className="capitalize">{b.status.replace(/_/g, " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="border border-border p-5 shadow-soft">
            <h3 className="mb-3 font-display text-lg text-primary">Account</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total bookings</dt><dd>{bookings.length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Open invoices</dt><dd>{invoices.filter((i) => i.status !== "paid" && i.status !== "void").length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Lifetime spend</dt><dd>{formatCents(invoices.reduce((s, i) => s + (i.amount_paid_cents ?? 0), 0))}</dd></div>
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="pets" className="mt-4">
          <Card className="border border-border p-4 shadow-soft">
            {pets.length === 0 ? (
              <EmptyState icon={<PawPrint className="h-7 w-7" />} title="No pets on file" />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {pets.map((p) => (
                  <li key={p.id}>
                    <Link to={`/sitter/pets/${p.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted">
                      <Avatar className="h-10 w-10"><AvatarImage src={p.photo_url ?? undefined} /><AvatarFallback>{p.name?.slice(0,1)}</AvatarFallback></Avatar>
                      <div className="font-medium">{p.name}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <Card className="border border-border p-4 shadow-soft">
            {bookings.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No bookings" />
            ) : (
              <ul className="divide-y divide-border">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium">{b.services?.name} · {b.pets?.name}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(b.start_at), "EEE MMM d, h:mm a")}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{b.status.replace(/_/g, " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card className="border border-border p-4 shadow-soft">
            {invoices.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-7 w-7" />} title="No invoices" />
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium">{i.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(i.created_at), "MMM d, yyyy")}{i.due_date ? ` · due ${format(new Date(i.due_date), "MMM d")}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-base text-primary">{formatCents(i.total_cents)}</div>
                      <Badge variant="outline" className="capitalize">{i.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </SitterShell>
  );
}
