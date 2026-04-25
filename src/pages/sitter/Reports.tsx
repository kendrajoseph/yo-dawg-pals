import { useEffect, useMemo, useState } from "react";
import { TrendingUp, CreditCard, AlertTriangle, CalendarCheck } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { KpiTile } from "@/components/sitter/KpiTile";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCents } from "@/lib/invoices";

type Aging = { current: number; d30: number; d60: number; d90: number };

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
