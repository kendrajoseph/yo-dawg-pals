import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Inbox as InboxIcon, AlertTriangle, CreditCard, PawPrint, Bell } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Filter = "all" | "requests" | "approvals" | "payments";

type Row = {
  kind: "request" | "approval" | "payment";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

export default function SitterInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const sitterId = user.id;
      const [requestsRes, approvalsRes, invoicesRes] = await Promise.all([
        supabase.from("bookings")
          .select("id, request_group_id, bundle_position, services(name), pets(name), requested_date, requested_window_label, created_at, customer_id")
          .eq("sitter_id", sitterId).eq("status", "requested")
          .order("created_at", { ascending: false }),
        supabase.from("pet_fit_alerts")
          .select("id, title, message, severity, created_at, pet_id, pets:pet_id(name)")
          .eq("is_resolved", false).order("created_at", { ascending: false }),
        supabase.from("invoices")
          .select("id, invoice_number, total_cents, amount_paid_cents, due_date, status")
          .eq("sitter_id", sitterId)
          .in("status", ["sent", "overdue", "partial"]),
      ]);

      if (cancelled) return;
      const out: Row[] = [];

      // ─── Group bookings by request_group_id ───
      const requestBookings = (requestsRes.data ?? []) as any[];
      const grouped = new Map<string, any[]>();
      const ungrouped: any[] = [];

      for (const r of requestBookings) {
        if (r.request_group_id) {
          const list = grouped.get(r.request_group_id) ?? [];
          list.push(r);
          grouped.set(r.request_group_id, list);
        } else {
          ungrouped.push(r);
        }
      }

      // Resolve customer names for grouped requests
      const allCustomerIds = [...new Set(requestBookings.map((r: any) => r.customer_id).filter(Boolean))];
      let customerNames = new Map<string, string>();
      if (allCustomerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allCustomerIds);
        for (const p of profiles ?? []) {
          customerNames.set(p.id, p.full_name ?? "Client");
        }
      }

      // Render grouped requests as single rows
      for (const [groupId, bookings] of grouped) {
        const sorted = bookings.sort((a: any, b: any) => (a.bundle_position ?? 0) - (b.bundle_position ?? 0));
        const first = sorted[0];
        const petNames = sorted.map((b: any) => b.pets?.name ?? "pet");
        const petList = petNames.length <= 3
          ? petNames.join(", ")
          : `${petNames.slice(0, 2).join(", ")} + ${petNames.length - 2} more`;
        const serviceName = first.services?.name ?? "Service";
        const customerName = customerNames.get(first.customer_id) ?? "Client";
        const dateLabel = first.requested_date
          ? format(new Date(first.requested_date), "EEE, MMM d")
          : "Date TBD";
        const windowLabel = first.requested_window_label ?? "";

        out.push({
          kind: "request",
          id: groupId,
          title: `${customerName} — ${serviceName} for ${petList}`,
          subtitle: `${dateLabel}${windowLabel ? ` · ${windowLabel}` : ""}`,
          meta: sorted.length > 1 ? `${sorted.length} pets` : undefined,
          href: sorted.length > 1
            ? `/sitter/requests/group/${groupId}`
            : `/sitter/requests/${first.id}`,
        });
      }

      // Render ungrouped requests as individual rows (backwards compat)
      for (const r of ungrouped) {
        out.push({
          kind: "request",
          id: r.id,
          title: `${r.services?.name ?? "Service"} for ${r.pets?.name ?? "pet"}`,
          subtitle: r.requested_date ? format(new Date(r.requested_date), "EEE, MMM d") : "Date TBD",
          meta: r.requested_window_label ?? undefined,
          href: `/sitter/requests/${r.id}`,
        });
      }

      for (const a of (approvalsRes.data ?? []) as any[]) {
        out.push({
          kind: "approval",
          id: a.id,
          title: a.title,
          subtitle: a.pets?.name ?? "Pet",
          meta: a.severity,
          href: a.pet_id ? `/sitter/pets/${a.pet_id}` : "/sitter/pets",
        });
      }
      const todayMs = Date.now();
      for (const i of (invoicesRes.data ?? []) as any[]) {
        const owed = (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0);
        const overdue = i.due_date && new Date(i.due_date + "T23:59:59").getTime() < todayMs;
        const prefix = overdue ? "Overdue: " : i.status === "partial" ? "Partial: " : "Outstanding: ";
        out.push({
          kind: "payment",
          id: i.id,
          title: `${prefix}${i.invoice_number}`,
          subtitle: `$${(owed / 100).toFixed(2)} owed`,
          meta: i.due_date ? `due ${format(new Date(i.due_date), "MMM d")}` : undefined,
          href: "/sitter/invoices",
        });
      }

      setRows(out);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "requests") return rows.filter((r) => r.kind === "request");
    if (filter === "approvals") return rows.filter((r) => r.kind === "approval");
    return rows.filter((r) => r.kind === "payment");
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    requests: rows.filter((r) => r.kind === "request").length,
    approvals: rows.filter((r) => r.kind === "approval").length,
    payments: rows.filter((r) => r.kind === "payment").length,
  }), [rows]);

  return (
    <SitterShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Inbox</h1>
        <p className="text-sm text-muted-foreground">Everything that needs your attention, in one queue.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["all", "All"],
          ["requests", "Booking requests"],
          ["approvals", "Pet approvals"],
          ["payments", "Payment issues"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/70 hover:bg-muted"
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 ${filter === key ? "bg-primary-foreground/20" : "bg-muted"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <Card className="border border-border shadow-soft">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<InboxIcon className="h-8 w-8" />}
            title="Inbox zero"
            description="Nothing waiting. New requests, pet approvals, and overdue invoices will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const Icon = r.kind === "request" ? Bell : r.kind === "approval" ? PawPrint : r.kind === "payment" ? CreditCard : AlertTriangle;
              return (
                <li key={`${r.kind}-${r.id}`}>
                  <button onClick={() => navigate(r.href)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted">
                    <div className="rounded-md bg-muted p-2 text-foreground/70"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.subtitle}{r.meta ? ` · ${r.meta}` : ""}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{r.kind}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tip: requests, approvals, and overdue invoices are unified here. Open a row to act on it in the right page.
      </p>
    </SitterShell>
  );
}
