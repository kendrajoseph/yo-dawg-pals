import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Inbox as InboxIcon, AlertTriangle, CreditCard, PawPrint, Bell,
  MessageSquare, Search, Plus, Trash2, Mail, FileText, Receipt, Eye, Send, AlertOctagon, RefreshCw,
} from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/integrations/posthog/PostHogProvider";
import { MessageComposer } from "@/components/sitter/MessageComposer";
import { EmailViewerDialog } from "@/components/payments/EmailViewerDialog";
import { toast } from "@/hooks/use-toast";

type InboxFilter = "all" | "requests" | "approvals" | "payments";
type InboxRow = {
  kind: "request" | "approval" | "payment";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

function InboxTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
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
          .eq("sitter_id", sitterId).in("status", ["sent", "overdue", "partial"]),
      ]);
      if (cancelled) return;
      const out: InboxRow[] = [];

      const requestBookings = (requestsRes.data ?? []) as any[];
      const grouped = new Map<string, any[]>();
      const ungrouped: any[] = [];
      for (const r of requestBookings) {
        if (r.request_group_id) {
          const list = grouped.get(r.request_group_id) ?? [];
          list.push(r); grouped.set(r.request_group_id, list);
        } else ungrouped.push(r);
      }
      const allCustomerIds = [...new Set(requestBookings.map((r: any) => r.customer_id).filter(Boolean))];
      const customerNames = new Map<string, string>();
      if (allCustomerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", allCustomerIds);
        for (const p of profiles ?? []) customerNames.set(p.id, p.full_name ?? "Client");
      }
      for (const [groupId, bookings] of grouped) {
        const sorted = bookings.sort((a: any, b: any) => (a.bundle_position ?? 0) - (b.bundle_position ?? 0));
        const first = sorted[0];
        const petNames = sorted.map((b: any) => b.pets?.name ?? "pet");
        const petList = petNames.length <= 3 ? petNames.join(", ") : `${petNames.slice(0, 2).join(", ")} + ${petNames.length - 2} more`;
        const serviceName = first.services?.name ?? "Service";
        const customerName = customerNames.get(first.customer_id) ?? "Client";
        const dateLabel = first.requested_date ? format(new Date(first.requested_date), "EEE, MMM d") : "Date TBD";
        const windowLabel = first.requested_window_label ?? "";
        out.push({
          kind: "request", id: groupId,
          title: `${customerName} — ${serviceName} for ${petList}`,
          subtitle: `${dateLabel}${windowLabel ? ` · ${windowLabel}` : ""}`,
          meta: sorted.length > 1 ? `${sorted.length} pets` : undefined,
          href: sorted.length > 1 ? `/sitter/requests/group/${groupId}` : `/sitter/requests/${first.id}`,
        });
      }
      for (const r of ungrouped) {
        out.push({
          kind: "request", id: r.id,
          title: `${r.services?.name ?? "Service"} for ${r.pets?.name ?? "pet"}`,
          subtitle: r.requested_date ? format(new Date(r.requested_date), "EEE, MMM d") : "Date TBD",
          meta: r.requested_window_label ?? undefined,
          href: `/sitter/requests/${r.id}`,
        });
      }
      for (const a of (approvalsRes.data ?? []) as any[]) {
        out.push({
          kind: "approval", id: a.id, title: a.title,
          subtitle: a.pets?.name ?? "Pet", meta: a.severity,
          href: a.pet_id ? `/sitter/pets/${a.pet_id}` : "/sitter/pets",
        });
      }
      const todayMs = Date.now();
      for (const i of (invoicesRes.data ?? []) as any[]) {
        const owed = (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0);
        const overdue = i.due_date && new Date(i.due_date + "T23:59:59").getTime() < todayMs;
        const prefix = overdue ? "Overdue: " : i.status === "partial" ? "Partial: " : "Outstanding: ";
        out.push({
          kind: "payment", id: i.id,
          title: `${prefix}${i.invoice_number}`,
          subtitle: `$${(owed / 100).toFixed(2)} owed`,
          meta: i.due_date ? `due ${format(new Date(i.due_date), "MMM d")}` : undefined,
          href: "/sitter/invoices",
        });
      }
      setRows(out);
      setLoading(false);
    })();
    return () => { cancelled = true; };
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
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["all", "All"], ["requests", "Booking requests"],
          ["approvals", "Pet approvals"], ["payments", "Payment issues"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/70 hover:bg-muted"
            }`}>
            {label}
            <span className={`rounded-full px-1.5 ${filter === key ? "bg-primary-foreground/20" : "bg-muted"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>
      <Card className="border border-border shadow-soft">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<InboxIcon className="h-8 w-8" />} title="Inbox zero"
            description="Nothing waiting. New requests, pet approvals, and overdue invoices will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const Icon = r.kind === "request" ? Bell : r.kind === "approval" ? PawPrint : r.kind === "payment" ? CreditCard : AlertTriangle;
              return (
                <li key={`${r.kind}-${r.id}`}>
                  <button onClick={() => { track("sitter_request_opened", { kind: r.kind }); navigate(r.href); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted">
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
    </>
  );
}

type SentRow = {
  id: string; customer_id: string | null; customer_name: string | null; avatar_url: string | null;
  subject: string; message: string; created_at: string; kind: string; email_html: string | null;
  source: "archive" | "log"; recipient_email?: string;
};

const KIND_META: Record<string, { label: string; icon: any; className: string }> = {
  invoice:          { label: "Invoice",   icon: FileText,      className: "bg-blue-100 text-blue-800 border-blue-200" },
  receipt:          { label: "Receipt",   icon: Receipt,       className: "bg-green-100 text-green-800 border-green-200" },
  reminder:         { label: "Reminder",  icon: Bell,          className: "bg-amber-100 text-amber-800 border-amber-200" },
  service_update:   { label: "Update",    icon: MessageSquare, className: "bg-purple-100 text-purple-800 border-purple-200" },
  offer:            { label: "Offer",     icon: Mail,          className: "bg-pink-100 text-pink-800 border-pink-200" },
  customer_service: { label: "Message",   icon: MessageSquare, className: "bg-muted text-foreground border-border" },
};

const TEMPLATE_TO_KIND: Record<string, { kind: string; subject: string }> = {
  "invoice-issued":              { kind: "invoice",          subject: "Invoice sent" },
  "payment-receipt":             { kind: "receipt",          subject: "Payment receipt" },
  "payment-reminder":            { kind: "reminder",         subject: "Payment reminder" },
  "client-direct-message":       { kind: "customer_service", subject: "Direct message" },
  "walk-request-received":       { kind: "service_update",   subject: "Walk request received" },
  "walk-schedule-confirmed":     { kind: "service_update",   subject: "Walk schedule confirmed" },
  "booking-declined":            { kind: "service_update",   subject: "Booking declined" },
  "group-walk-payment-request":  { kind: "invoice",          subject: "Group walk payment request" },
  "booking-paid-notification":   { kind: "receipt",          subject: "Payment received" },
  "refund-issued":               { kind: "receipt",          subject: "Refund issued" },
};

const SENT_FILTERS = [
  { value: "all", label: "All" },
  { value: "messages", label: "Messages" },
  { value: "invoice", label: "Invoices" },
  { value: "receipt", label: "Receipts" },
  { value: "reminder", label: "Reminders" },
];

function SentTab({ onCompose }: { onCompose: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ open: boolean; subject?: string; html?: string | null; sentAt?: string }>({ open: false });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("client_messages").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast({ title: "Couldn't delete", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sitterEmail = (user.email ?? "").toLowerCase();
      const [archiveRes, logRes] = await Promise.all([
        supabase.from("client_messages")
          .select("id, subject, message, created_at, customer_id, kind, email_html")
          .eq("sitter_id", user.id).order("created_at", { ascending: false }).limit(300),
        supabase.from("email_send_log")
          .select("id, message_id, template_name, recipient_email, status, created_at")
          .eq("status", "sent").order("created_at", { ascending: false }).limit(500),
      ]);
      if (cancelled) return;

      const archived = (archiveRes.data ?? []) as any[];
      const ids = Array.from(new Set(archived.map((r) => r.customer_id).filter(Boolean)));
      let profiles = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
        profiles = new Map((p ?? []).map((x: any) => [x.id, { full_name: x.full_name, avatar_url: x.avatar_url }]));
      }
      const archivedRows: SentRow[] = archived.map((m) => ({
        id: m.id, customer_id: m.customer_id,
        customer_name: profiles.get(m.customer_id)?.full_name ?? null,
        avatar_url: profiles.get(m.customer_id)?.avatar_url ?? null,
        subject: m.subject, message: m.message, created_at: m.created_at,
        kind: m.kind ?? "customer_service", email_html: m.email_html ?? null,
        source: "archive",
      }));

      // Dedupe: skip log rows that match an archived row by same minute.
      const archivedMinutes = new Set(
        archived.map((m: any) => (m.created_at as string)?.slice(0, 16))
      );

      const logRows: SentRow[] = [];
      for (const l of (logRes.data ?? []) as any[]) {
        const recipient = (l.recipient_email ?? "").toLowerCase();
        if (!recipient || recipient === sitterEmail) continue;
        const tpl = TEMPLATE_TO_KIND[l.template_name];
        if (!tpl) continue;
        if (archivedMinutes.has((l.created_at as string)?.slice(0, 16))) continue;
        logRows.push({
          id: `log-${l.id}`,
          customer_id: null,
          customer_name: recipient,
          avatar_url: null,
          subject: tpl.subject,
          message: `Sent to ${recipient}`,
          created_at: l.created_at,
          kind: tpl.kind,
          email_html: null,
          source: "log",
          recipient_email: recipient,
        });
      }

      const merged = [...archivedRows, ...logRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "messages" && !["customer_service", "service_update", "offer"].includes(r.kind)) return false;
      if (["invoice", "receipt", "reminder"].includes(filter) && r.kind !== filter) return false;
      if (!q) return true;
      return (r.customer_name ?? "").toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) || r.message.toLowerCase().includes(q);
    });
  }, [rows, search, filter]);

  return (
    <Card className="border border-border p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, subject, content" className="pl-8" />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>{SENT_FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Send className="h-8 w-8" />} title="Nothing sent yet"
          description="Messages, invoices, receipts, and reminders you send will show up here."
          action={<Button size="sm" onClick={onCompose}>Compose a message</Button>} />
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((r) => {
            const meta = KIND_META[r.kind] ?? KIND_META.customer_service;
            const Icon = meta.icon;
            return (
              <li key={r.id} className="flex items-start gap-3 px-2 py-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{(r.customer_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                      <Icon className="h-3 w-3" />{meta.label}
                    </Badge>
                    {r.customer_id ? (
                      <Link to={`/sitter/clients/${r.customer_id}`} className="truncate font-medium hover:underline">
                        {r.customer_name ?? "Client"}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-muted-foreground">{r.customer_name ?? "Client"}</span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm">{r.subject}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.message}</div>
                  <div className="mt-2 flex items-center gap-1">
                    {r.email_html ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={() => setViewer({ open: true, subject: r.subject, html: r.email_html, sentAt: r.created_at })}>
                        <Eye className="h-3.5 w-3.5" />View email
                      </Button>
                    ) : r.source === "log" ? (
                      <span className="text-[11px] text-muted-foreground">Sent before email archiving was enabled — original not stored.</span>
                    ) : null}
                    {r.source === "archive" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive" disabled={deletingId === r.id}>
                            <Trash2 className="h-3.5 w-3.5" />Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes it from your hub. The email already sent to the client is unaffected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(r.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EmailViewerDialog open={viewer.open} onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        subject={viewer.subject} html={viewer.html} sentAt={viewer.sentAt} />
    </Card>
  );
}

type OutboxRow = {
  id: string; created_at: string; recipient_email: string;
  template_name: string; status: string; error_message: string | null; message_id: string | null;
};

const FAILED_STATUSES = ["failed", "dlq", "bounced", "complained"];

function OutboxTab({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, created_at, recipient_email, template_name, status, error_message, message_id")
        .in("status", FAILED_STATUSES)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) { console.error(error); setLoading(false); return; }
      const seen = new Set<string>();
      const deduped: OutboxRow[] = [];
      for (const r of (data ?? []) as any[]) {
        const key = r.message_id ?? r.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }
      setRows(deduped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadKey, refreshTick]);

  return (
    <Card className="border border-border p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Emails that bounced, were rejected, or hit the dead-letter queue after retries.
        </p>
        <Button size="sm" variant="outline" onClick={() => setRefreshTick((t) => t + 1)} className="h-7 gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<AlertOctagon className="h-8 w-8" />} title="Nothing in the outbox"
          description="All emails are delivering. Failed sends will appear here so you can take action." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-2 py-3">
              <div className="rounded-md bg-destructive/10 p-2 text-destructive"><AlertOctagon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive capitalize">{r.status}</Badge>
                  <span className="truncate text-sm font-medium">{r.recipient_email}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Template: {r.template_name}</div>
                {r.error_message ? (
                  <div className="mt-1 break-words text-xs text-destructive/80">{r.error_message}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SitterEmails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "inbox";
  const [tab, setTab] = useState(initialTab);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentReloadKey, setSentReloadKey] = useState(0);

  const setTabAndUrl = (next: string) => {
    setTab(next);
    setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("tab", next); return p; }, { replace: true });
  };

  return (
    <SitterShell action={<Button size="sm" onClick={() => setComposeOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Compose</Button>}>
      <SitterPageHeader
        back={{ to: "/sitter", label: "Back to dashboard" }}
        title="Emails"
        description="Inbox, sent history, and anything that failed to deliver — all in one place."
      />
      <Tabs value={tab} onValueChange={setTabAndUrl} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5"><InboxIcon className="h-4 w-4" />Inbox</TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5"><Send className="h-4 w-4" />Sent</TabsTrigger>
          <TabsTrigger value="outbox" className="gap-1.5"><AlertOctagon className="h-4 w-4" />Outbox</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox"><InboxTab /></TabsContent>
        <TabsContent value="sent" key={sentReloadKey}><SentTab onCompose={() => setComposeOpen(true)} /></TabsContent>
        <TabsContent value="outbox"><OutboxTab reloadKey={sentReloadKey} /></TabsContent>
      </Tabs>
      <MessageComposer open={composeOpen} onOpenChange={setComposeOpen} onSent={() => setSentReloadKey((k) => k + 1)} />
    </SitterShell>
  );
}
