import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, CreditCard, AlertTriangle, CalendarCheck, Download, FileSpreadsheet } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { KpiTile } from "@/components/sitter/KpiTile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCents, derivedStatus } from "@/lib/invoices";
import { downloadCsv, formatCentsForCsv, isoDate } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";

type Aging = { current: number; d30: number; d60: number; d90: number };

type RangePreset = "mtd" | "ytd" | "last12" | "all" | "custom";

const computeRange = (preset: RangePreset, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null; label: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (preset) {
    case "mtd":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today, label: "month-to-date" };
    case "ytd":
      return { from: new Date(now.getFullYear(), 0, 1), to: today, label: "year-to-date" };
    case "last12": {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { from, to: today, label: "last-12-months" };
    }
    case "all":
      return { from: null, to: null, label: "all-time" };
    case "custom": {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return { from, to, label: `${customFrom ?? "start"}_${customTo ?? "today"}` };
    }
  }
};

export default function SitterReports() {
  const { user } = useAuth();
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueYTD, setRevenueYTD] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [topServices, setTopServices] = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [cancelRate, setCancelRate] = useState(0);
  const [aging, setAging] = useState<Aging>({ current: 0, d30: 0, d60: 0, d90: 0 });
  const [loading, setLoading] = useState(true);

  const [rangePreset, setRangePreset] = useState<RangePreset>("ytd");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const sitterId = user.id;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [invoicesRes, bookingsRes] = await Promise.all([
        supabase.from("invoices").select("total_cents, amount_paid_cents, status, due_date, paid_at").eq("sitter_id", sitterId),
        supabase.from("bookings").select("status, total_cents, services(name), start_at").eq("sitter_id", sitterId),
      ]);

      if (cancelled) return;

      let rMonth = 0, rYTD = 0, out = 0;
      const ag: Aging = { current: 0, d30: 0, d60: 0, d90: 0 };
      const today = Date.now();
      for (const i of (invoicesRes.data ?? []) as any[]) {
        if (i.status === "paid" && i.paid_at) {
          const paid = new Date(i.paid_at);
          if (paid >= monthStart) rMonth += i.total_cents ?? 0;
          if (paid >= yearStart) rYTD += i.total_cents ?? 0;
        }
        if (["sent", "overdue", "partial"].includes(i.status)) {
          const owed = (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0);
          out += owed;
          if (i.due_date) {
            const daysPast = Math.floor((today - new Date(i.due_date + "T23:59:59").getTime()) / (1000 * 60 * 60 * 24));
            if (daysPast <= 0) ag.current += owed;
            else if (daysPast <= 30) ag.d30 += owed;
            else if (daysPast <= 60) ag.d60 += owed;
            else ag.d90 += owed;
          } else ag.current += owed;
        }
      }

      let bookingsMonth = 0, totalBookings = 0, cancelled_ = 0;
      const svc = new Map<string, { count: number; revenue: number }>();
      for (const b of (bookingsRes.data ?? []) as any[]) {
        totalBookings += 1;
        if (b.status === "cancelled") cancelled_ += 1;
        if (new Date(b.start_at) >= monthStart) bookingsMonth += 1;
        const name = b.services?.name ?? "Other";
        const cur = svc.get(name) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += b.total_cents ?? 0;
        svc.set(name, cur);
      }
      setRevenueMonth(rMonth);
      setRevenueYTD(rYTD);
      setOutstanding(out);
      setAging(ag);
      setBookingsThisMonth(bookingsMonth);
      setCancelRate(totalBookings > 0 ? Math.round((cancelled_ / totalBookings) * 100) : 0);
      setTopServices([...svc.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const agingTotal = useMemo(() => aging.current + aging.d30 + aging.d60 + aging.d90, [aging]);

  const range = useMemo(() => computeRange(rangePreset, customFrom, customTo), [rangePreset, customFrom, customTo]);

  const buildFileName = (kind: string) => {
    if (rangePreset === "all") return `yodawg-${kind}-all-time-${isoDate(new Date())}.csv`;
    const from = range.from ? isoDate(range.from) : "start";
    const to = range.to ? isoDate(range.to) : isoDate(new Date());
    return `yodawg-${kind}-${from}_${to}.csv`;
  };

  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (range.from && t < range.from.getTime()) return false;
    if (range.to && t > range.to.getTime()) return false;
    return true;
  };

  const exportInvoices = async () => {
    if (!user?.id) return;
    setExporting("invoices");
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, subtotal_cents, total_cents, amount_paid_cents, due_date, sent_at, paid_at, created_at, customer_id, notes")
      .eq("sitter_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setExporting(null);
      toast({ title: "Couldn't export invoices", description: error.message, variant: "destructive" });
      return;
    }
    const filtered = (data ?? []).filter((i: any) => {
      // Use paid_at when paid, else created_at, to determine in-range
      const ref = i.paid_at ?? i.created_at;
      return inRange(ref);
    });
    const customerIds = Array.from(new Set(filtered.map((i: any) => i.customer_id).filter(Boolean)));
    const { data: profiles } = customerIds.length
      ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rows = filtered.map((i: any) => {
      const p = profileMap.get(i.customer_id) as any;
      const status = derivedStatus(i);
      const balance = (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0);
      return {
        "Invoice #": i.invoice_number,
        "Customer": p?.full_name ?? "",
        "Customer phone": p?.phone ?? "",
        "Status": status,
        "Issued": i.created_at ? isoDate(new Date(i.created_at)) : "",
        "Sent": i.sent_at ? isoDate(new Date(i.sent_at)) : "",
        "Due": i.due_date ?? "",
        "Paid on": i.paid_at ? isoDate(new Date(i.paid_at)) : "",
        "Subtotal": formatCentsForCsv(i.subtotal_cents),
        "Total": formatCentsForCsv(i.total_cents),
        "Paid": formatCentsForCsv(i.amount_paid_cents),
        "Balance": formatCentsForCsv(balance),
        "Notes": i.notes ?? "",
      };
    });
    setExporting(null);
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No invoices in this date range." });
      return;
    }
    downloadCsv(buildFileName("invoices"), rows);
    toast({ title: "Exported", description: `${rows.length} invoice${rows.length === 1 ? "" : "s"} downloaded.` });
  };

  const exportPayments = async () => {
    if (!user?.id) return;
    setExporting("payments");
    // payment_events RLS lets sitters see only their own payments via the joined invoice/booking.
    const { data, error } = await supabase
      .from("payment_events")
      .select("id, kind, channel, amount_cents, created_at, booking_id, invoice_id, metadata, invoices(invoice_number, customer_id), bookings(customer_id, services(name))")
      .order("created_at", { ascending: false });
    if (error) {
      setExporting(null);
      toast({ title: "Couldn't export payments", description: error.message, variant: "destructive" });
      return;
    }
    const filtered = (data ?? []).filter((p: any) => inRange(p.created_at));
    const customerIds = Array.from(new Set(
      filtered.flatMap((p: any) => [p.invoices?.customer_id, p.bookings?.customer_id]).filter(Boolean)
    ));
    const { data: profiles } = customerIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", customerIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rows = filtered.map((p: any) => {
      const customerId = p.invoices?.customer_id ?? p.bookings?.customer_id ?? null;
      const profile = customerId ? (profileMap.get(customerId) as any) : null;
      return {
        "Date": isoDate(new Date(p.created_at)),
        "Kind": p.kind ?? "",
        "Channel": p.channel ?? "",
        "Amount": formatCentsForCsv(p.amount_cents),
        "Customer": profile?.full_name ?? "",
        "Invoice #": p.invoices?.invoice_number ?? "",
        "Booking service": p.bookings?.services?.name ?? "",
      };
    });
    setExporting(null);
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No payments in this date range." });
      return;
    }
    downloadCsv(buildFileName("payments"), rows);
    toast({ title: "Exported", description: `${rows.length} payment${rows.length === 1 ? "" : "s"} downloaded.` });
  };

  const exportBookings = async () => {
    if (!user?.id) return;
    setExporting("bookings");
    const { data, error } = await supabase
      .from("bookings")
      .select("id, start_at, end_at, status, payment_status, total_cents, payment_amount_cents, customer_id, services(name), pets(name)")
      .eq("sitter_id", user.id)
      .order("start_at", { ascending: false });
    if (error) {
      setExporting(null);
      toast({ title: "Couldn't export bookings", description: error.message, variant: "destructive" });
      return;
    }
    const filtered = (data ?? []).filter((b: any) => inRange(b.start_at));
    const customerIds = Array.from(new Set(filtered.map((b: any) => b.customer_id).filter(Boolean)));
    const { data: profiles } = customerIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", customerIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rows = filtered.map((b: any) => {
      const profile = b.customer_id ? (profileMap.get(b.customer_id) as any) : null;
      return {
        "Start": b.start_at ? new Date(b.start_at).toISOString() : "",
        "End": b.end_at ? new Date(b.end_at).toISOString() : "",
        "Status": b.status ?? "",
        "Payment status": b.payment_status ?? "",
        "Service": b.services?.name ?? "",
        "Pet": b.pets?.name ?? "",
        "Customer": profile?.full_name ?? "",
        "Total": formatCentsForCsv(b.total_cents),
        "Paid": formatCentsForCsv(b.payment_amount_cents),
      };
    });
    setExporting(null);
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No bookings in this date range." });
      return;
    }
    downloadCsv(buildFileName("bookings"), rows);
    toast({ title: "Exported", description: `${rows.length} booking${rows.length === 1 ? "" : "s"} downloaded.` });
  };

  return (
    <SitterShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Reports</h1>
        <p className="text-sm text-muted-foreground">A snapshot of your business performance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Revenue this month" value={loading ? "—" : formatCents(revenueMonth)} tone="success" icon={<TrendingUp className="h-5 w-5" />} />
        <KpiTile label="Revenue YTD" value={loading ? "—" : formatCents(revenueYTD)} icon={<CreditCard className="h-5 w-5" />} />
        <KpiTile label="Outstanding A/R" value={loading ? "—" : formatCents(outstanding)} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiTile label="Bookings this month" value={loading ? "—" : bookingsThisMonth} icon={<CalendarCheck className="h-5 w-5" />} hint={`Cancel rate ${cancelRate}%`} />
      </div>

      <Card className="mt-6 border border-border p-5 shadow-soft">
        <div className="mb-4 flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display text-lg text-primary">Financial exports</h3>
            <p className="text-xs text-muted-foreground">Download your invoices, payments, and bookings as CSV — opens in Excel, Numbers, or Google Sheets.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[200px,1fr,1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Date range</Label>
            <Select value={rangePreset} onValueChange={(v) => setRangePreset(v as RangePreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mtd">Month-to-date</SelectItem>
                <SelectItem value="ytd">Year-to-date</SelectItem>
                <SelectItem value="last12">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rangePreset === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="custom-from" className="text-xs">From</Label>
                <Input id="custom-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-to" className="text-xs">To</Label>
                <Input id="custom-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportInvoices} disabled={exporting !== null} variant="outline">
            <Download className="mr-1.5 h-4 w-4" />{exporting === "invoices" ? "Exporting…" : "Invoices CSV"}
          </Button>
          <Button onClick={exportPayments} disabled={exporting !== null} variant="outline">
            <Download className="mr-1.5 h-4 w-4" />{exporting === "payments" ? "Exporting…" : "Payments CSV"}
          </Button>
          <Button onClick={exportBookings} disabled={exporting !== null} variant="outline">
            <Download className="mr-1.5 h-4 w-4" />{exporting === "bookings" ? "Exporting…" : "Bookings CSV"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 font-display text-lg text-primary">Top services</h3>
          {topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((s) => {
                const max = topServices[0].revenue || 1;
                const width = Math.max(4, Math.round((s.revenue / max) * 100));
                return (
                  <li key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{formatCents(s.revenue)} · {s.count} booking{s.count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-3 font-display text-lg text-primary">A/R aging</h3>
          {agingTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding invoices. 🎉</p>
          ) : (
            <div className="space-y-2 text-sm">
              {[
                ["Current (not overdue)", aging.current],
                ["1–30 days overdue", aging.d30],
                ["31–60 days overdue", aging.d60],
                ["60+ days overdue", aging.d90],
              ].map(([label, val]) => {
                const pct = Math.round(((val as number) / agingTotal) * 100);
                return (
                  <div key={label as string}>
                    <div className="flex justify-between"><span>{label as string}</span><span className="text-muted-foreground">{formatCents(val as number)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </SitterShell>
  );
}
