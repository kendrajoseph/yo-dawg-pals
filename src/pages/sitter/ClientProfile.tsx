import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Mail, Phone, PawPrint, CalendarDays, CreditCard, MessageSquare, Star, Save, Download } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCents, derivedStatus } from "@/lib/invoices";
import { downloadCsv, formatCentsForCsv, todayStamp } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";

export default function SitterClientProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Internal admin profile (rating + private notes — only visible to Anneke/admins)
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);
  const [starRating, setStarRating] = useState<number>(3);
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [savedRating, setSavedRating] = useState<number>(3);
  const [savedNotes, setSavedNotes] = useState<string>("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const dirty = starRating !== savedRating || internalNotes !== savedNotes;

  useEffect(() => {
    if (!id || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      const [pRes, bookingsRes, invoicesRes, adminRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("bookings")
          .select("id, start_at, end_at, status, total_cents, payment_status, services(name), pets(id, name, photo_url)")
          .eq("sitter_id", user.id).eq("customer_id", id)
          .order("start_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, status, total_cents, amount_paid_cents, due_date, created_at")
          .eq("sitter_id", user.id).eq("customer_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("client_admin_profiles")
          .select("id, star_rating, internal_notes")
          .eq("client_id", id)
          .maybeSingle(),
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
      const a = adminRes.data;
      setAdminProfileId(a?.id ?? null);
      const r = a?.star_rating ?? 3;
      const n = a?.internal_notes ?? "";
      setStarRating(r);
      setInternalNotes(n);
      setSavedRating(r);
      setSavedNotes(n);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const saveAdminProfile = async () => {
    if (!id || !user?.id) return;
    setSavingAdmin(true);
    const payload = {
      client_id: id,
      star_rating: starRating,
      internal_notes: internalNotes.trim() || null,
      last_updated_by: user.id,
    };
    const { data, error } = adminProfileId
      ? await supabase
          .from("client_admin_profiles")
          .update(payload)
          .eq("id", adminProfileId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("client_admin_profiles")
          .insert(payload)
          .select("id")
          .maybeSingle();
    setSavingAdmin(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.id) setAdminProfileId(data.id);
    setSavedRating(starRating);
    setSavedNotes(internalNotes);
    toast({ title: "Saved", description: "Internal notes updated." });
  };

  const exportClientInvoicesCsv = () => {
    if (invoices.length === 0) {
      toast({ title: "No invoices to export" });
      return;
    }
    const clientName = profile?.full_name?.replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase() ?? "client";
    const rows = invoices.map((i: any) => {
      const status = derivedStatus(i);
      const balance = (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0);
      return {
        "Invoice #": i.invoice_number,
        "Client": profile?.full_name ?? "",
        "Status": status,
        "Issued": i.created_at ? new Date(i.created_at).toISOString().slice(0, 10) : "",
        "Due": i.due_date ?? "",
        "Total": formatCentsForCsv(i.total_cents),
        "Paid": formatCentsForCsv(i.amount_paid_cents),
        "Balance": formatCentsForCsv(balance),
      };
    });
    downloadCsv(`yodawg-${clientName}-invoices-${todayStamp()}.csv`, rows);
    toast({ title: "Exported", description: `${rows.length} invoice${rows.length === 1 ? "" : "s"} downloaded.` });
  };

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

          <Card className="border-2 border-amber-200/60 bg-amber-50/40 p-5 shadow-soft lg:col-span-2 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg text-primary">Internal client notes</h3>
                <p className="text-xs text-muted-foreground">Only visible to you. Clients never see this.</p>
              </div>
              <Button size="sm" onClick={saveAdminProfile} disabled={savingAdmin || !dirty}>
                <Save className="mr-1.5 h-4 w-4" />{savingAdmin ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </Button>
            </div>

            <div className="mb-4 space-y-1.5">
              <Label className="text-xs">Star rating</Label>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1;
                  const filled = value <= starRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      onClick={() => setStarRating(value)}
                      className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <Star className={`h-6 w-6 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-muted-foreground">{starRating}/5</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="internal-notes" className="text-xs">Private notes</Label>
              <Textarea
                id="internal-notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Quirks, gate codes, tipping habits, payment patterns, anything you want to remember about this client…"
                rows={5}
                className="bg-background"
              />
            </div>
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
