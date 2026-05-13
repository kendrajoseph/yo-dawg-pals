import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CreditCard, Search, Send, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
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
import { toast } from "sonner";
import { SitterShell } from "@/components/sitter/SitterShell";
import { KpiTile } from "@/components/sitter/KpiTile";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PaymentDrawer, type PaymentDrawerBooking } from "@/components/payments/PaymentDrawer";
import { InvoiceDrawer } from "@/components/payments/InvoiceDrawer";
import { derivedStatus, formatCents, statusBadgeClass, type Invoice } from "@/lib/invoices";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type InvoiceRow = Invoice & {
  booking: {
    id: string;
    customer_id: string;
    service_id: string;
    start_at: string;
    end_at: string;
    payment_status: string | null;
    payment_amount_cents: number | null;
    paid_at: string | null;
    refund_id: string | null;
    stripe_payment_intent: string | null;
    stripe_charge_id: string | null;
  } | null;
  customer_name: string;
  service_name: string;
};

type StatusTab = "outstanding" | "overdue" | "drafts" | "paid" | "refunded" | "all";

export default function SitterInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusTab>("outstanding");
  const [drawerBooking, setDrawerBooking] = useState<PaymentDrawerBooking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invoiceDrawerId, setInvoiceDrawerId] = useState<string | null>(null);
  const [invoiceDrawerName, setInvoiceDrawerName] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const sendDraft = async (row: InvoiceRow) => {
    setSendingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId: row.id },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sent ${row.invoice_number} to ${row.customer_name}`);
      await load();
    } catch (e: any) {
      toast.error(`Could not send invoice`, { description: e?.message ?? "Try again." });
    } finally {
      setSendingId(null);
    }
  };

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: invoiceData, error } = await supabase.from("invoices")
      .select("*")
      .eq("sitter_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }

    const invoices = (invoiceData ?? []) as Invoice[];
    const bookingIds = [...new Set(invoices.map((i) => i.booking_id).filter(Boolean))];
    const customerIds = [...new Set(invoices.map((i) => i.customer_id).filter(Boolean))];

    const [bookingsRes, profilesRes] = await Promise.all([
      bookingIds.length
        ? supabase.from("bookings").select("id, customer_id, service_id, start_at, end_at, payment_status, payment_amount_cents, paid_at, refund_id, stripe_payment_intent, stripe_charge_id").in("id", bookingIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", customerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const bookings = new Map(((bookingsRes.data ?? []) as any[]).map((b) => [b.id, b]));
    const serviceIds = [...new Set(((bookingsRes.data ?? []) as any[]).map((b) => b.service_id).filter(Boolean))];
    const servicesRes = serviceIds.length
      ? await supabase.from("services").select("id, name").in("id", serviceIds)
      : { data: [] };
    const profiles = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.id, p.full_name ?? "Customer"]));
    const services = new Map(((servicesRes.data ?? []) as any[]).map((s) => [s.id, s.name ?? "Service"]));

    setRows(invoices.map((invoice) => {
      const booking = bookings.get(invoice.booking_id) ?? null;
      return {
        ...invoice,
        booking,
        customer_name: profiles.get(invoice.customer_id) ?? "Customer",
        service_name: booking ? services.get(booking.service_id) ?? "Service" : "Service",
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const enriched = useMemo(() => rows.map((r) => ({
    ...r,
    derived: derivedStatus(r),
  })), [rows]);

  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let paidThisMonth = 0;
    let drafts = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    for (const r of enriched) {
      const owed = (r.total_cents ?? 0) - (r.amount_paid_cents ?? 0);
      if (["sent", "overdue", "partial"].includes(r.derived)) outstanding += owed;
      if (r.derived === "overdue") overdue += owed;
      if (r.status === "draft") drafts += 1;
      if (r.status === "paid" && r.paid_at && new Date(r.paid_at).getTime() >= monthStart) {
        paidThisMonth += r.total_cents ?? 0;
      }
    }
    return { outstanding, overdue, paidThisMonth, drafts };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (tab === "outstanding") list = list.filter((r) => ["sent", "partial"].includes(r.derived));
    else if (tab === "overdue") list = list.filter((r) => r.derived === "overdue");
    else if (tab === "drafts") list = list.filter((r) => r.status === "draft");
    else if (tab === "paid") list = list.filter((r) => r.status === "paid");
    else if (tab === "refunded") list = list.filter((r) => r.status === "void");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.invoice_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.service_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [enriched, tab, search]);

  const openRow = (row: typeof enriched[number]) => {
    if (!row.booking) {
      setInvoiceDrawerId(row.id);
      setInvoiceDrawerName(row.customer_name);
      return;
    }
    const b = row.booking;
    setDrawerBooking({
      id: b.id,
      customer_id: b.customer_id,
      total_cents: row.total_cents,
      payment_amount_cents: b.payment_amount_cents,
      payment_status: b.payment_status,
      paid_at: b.paid_at,
      start_at: b.start_at,
      end_at: b.end_at,
      refund_id: b.refund_id,
      stripe_payment_intent: b.stripe_payment_intent,
      stripe_charge_id: b.stripe_charge_id,
      service_label: row.service_name,
      customer_name: row.customer_name,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: liErr } = await supabase
      .from("invoice_line_items")
      .delete()
      .eq("invoice_id", deleteTarget.id);
    if (liErr) {
      toast.error(`Could not delete line items: ${liErr.message}`);
      setDeleting(false);
      return;
    }
    const { error } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(`Could not delete invoice: ${error.message}`);
      return;
    }
    toast.success(`Deleted ${deleteTarget.invoice_number}`);
    setDeleteTarget(null);
    load();
  };

  return (
    <SitterShell>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage bills, charges, refunds, and reminders.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Outstanding" value={formatCents(stats.outstanding)} tone="warning" icon={<CreditCard className="h-5 w-5" />} />
        <KpiTile label="Overdue" value={formatCents(stats.overdue)} tone={stats.overdue > 0 ? "danger" : "default"} />
        <KpiTile label="Drafts (unsent)" value={String(stats.drafts)} tone={stats.drafts > 0 ? "warning" : "default"} icon={<Send className="h-5 w-5" />} />
        <KpiTile label="Paid this month" value={formatCents(stats.paidThisMonth)} tone="success" />
      </div>

      {stats.drafts > 0 && tab !== "drafts" && (
        <button
          onClick={() => setTab("drafts")}
          className="mt-3 w-full rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
        >
          You have <strong>{stats.drafts}</strong> draft invoice{stats.drafts === 1 ? "" : "s"} that haven't been sent to clients yet. Click to review.
        </button>
      )}

      <Card className="mt-6 border border-border p-4 shadow-soft">
        <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice #, customer, service" className="pl-8" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="refunded">Refunded</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-8 w-8" />}
                title={`No ${tab === "all" ? "" : tab + " "}invoices`}
                description="Invoices appear here as bookings are confirmed and bills are issued."
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((r) => {
                  const owed = (r.total_cents ?? 0) - (r.amount_paid_cents ?? 0);
                  return (
                    <li key={r.id} className="flex items-center gap-1">
                      <button onClick={() => openRow(r)} className="flex flex-1 items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.invoice_number}</span>
                            <Badge variant="outline" className={statusBadgeClass(r.derived)}>{r.derived}</Badge>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {r.customer_name} · {r.service_name}
                            {r.due_date ? ` · due ${format(new Date(r.due_date), "MMM d")}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-lg text-primary">{formatCents(r.total_cents)}</div>
                          {owed > 0 && r.status !== "paid" && (
                            <div className="text-[11px] text-muted-foreground">{formatCents(owed)} owed</div>
                          )}
                        </div>
                      </button>
                      {r.status === "draft" && (
                        <Button
                          size="sm"
                          className="mr-1"
                          onClick={(e) => { e.stopPropagation(); sendDraft(r); }}
                          disabled={sendingId === r.id}
                        >
                          <Send className="h-4 w-4" /> {sendingId === r.id ? "Sending…" : "Send"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                        aria-label={`Delete ${r.invoice_number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <PaymentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        booking={drawerBooking}
        hasSavedCard={false}
        onChanged={load}
      />

      <InvoiceDrawer
        open={!!invoiceDrawerId}
        onOpenChange={(o) => { if (!o) setInvoiceDrawerId(null); }}
        invoiceId={invoiceDrawerId}
        customerName={invoiceDrawerName}
        onChanged={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice and its line items. The underlying booking and any payment records are not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SitterShell>
  );
}
