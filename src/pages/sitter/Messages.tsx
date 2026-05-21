import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search, Plus, Trash2, Mail, FileText, Receipt, Bell, Eye } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageComposer } from "@/components/sitter/MessageComposer";
import { EmailViewerDialog } from "@/components/payments/EmailViewerDialog";
import { toast } from "@/hooks/use-toast";

type Row = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  avatar_url: string | null;
  subject: string;
  message: string;
  created_at: string;
  kind: string;
  email_html: string | null;
};

const KIND_META: Record<string, { label: string; icon: any; className: string }> = {
  invoice:          { label: "Invoice",   icon: FileText,      className: "bg-blue-100 text-blue-800 border-blue-200" },
  receipt:          { label: "Receipt",   icon: Receipt,       className: "bg-green-100 text-green-800 border-green-200" },
  reminder:         { label: "Reminder",  icon: Bell,          className: "bg-amber-100 text-amber-800 border-amber-200" },
  service_update:   { label: "Update",    icon: MessageSquare, className: "bg-purple-100 text-purple-800 border-purple-200" },
  offer:            { label: "Offer",     icon: Mail,          className: "bg-pink-100 text-pink-800 border-pink-200" },
  customer_service: { label: "Message",   icon: MessageSquare, className: "bg-muted text-foreground border-border" },
};

const FILTERS = [
  { value: "all",      label: "All" },
  { value: "messages", label: "Messages" },
  { value: "invoice",  label: "Invoices" },
  { value: "receipt",  label: "Receipts" },
  { value: "reminder", label: "Reminders" },
];

export default function SitterMessages() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ open: boolean; subject?: string; html?: string | null; sentAt?: string }>({ open: false });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("client_messages").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("client_messages")
        .select("id, subject, message, created_at, customer_id, kind, email_html")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load client messages", error);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as any[];
      const ids = Array.from(new Set(list.map((r) => r.customer_id)));
      let profiles = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
        profiles = new Map((p ?? []).map((x: any) => [x.id, { full_name: x.full_name, avatar_url: x.avatar_url }]));
      }
      setRows(list.map((m) => ({
        id: m.id,
        customer_id: m.customer_id,
        customer_name: profiles.get(m.customer_id)?.full_name ?? null,
        avatar_url: profiles.get(m.customer_id)?.avatar_url ?? null,
        subject: m.subject,
        message: m.message,
        created_at: m.created_at,
        kind: m.kind ?? "customer_service",
        email_html: m.email_html ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "messages" && !["customer_service", "service_update", "offer"].includes(r.kind)) return false;
      if (["invoice", "receipt", "reminder"].includes(filter) && r.kind !== filter) return false;
      if (!q) return true;
      return (
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  return (
    <SitterShell action={
      <Button size="sm" onClick={() => setComposeOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Compose</Button>
    }>
      <SitterPageHeader
        back={{ to: "/sitter", label: "Back to dashboard" }}
        title="Messages"
        description="Every email and message sent to a client — open any item to see exactly what they received."
      />

      <Card className="border border-border p-4 shadow-soft">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, subject, content" className="pl-8" />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="Nothing here yet"
            description="Messages, invoices, receipts, and reminders you send will show up here."
            action={<Button size="sm" onClick={() => setComposeOpen(true)}>Compose a message</Button>}
          />
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
                      <Link to={`/sitter/clients/${r.customer_id}`} className="truncate font-medium hover:underline">
                        {r.customer_name ?? "Client"}
                      </Link>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm">{r.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.message}</div>
                    <div className="mt-2 flex items-center gap-1">
                      {r.email_html ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => setViewer({ open: true, subject: r.subject, html: r.email_html, sentAt: r.created_at })}
                        >
                          <Eye className="h-3.5 w-3.5" />View email
                        </Button>
                      ) : null}
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
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <MessageComposer open={composeOpen} onOpenChange={setComposeOpen} onSent={() => setReloadKey((k) => k + 1)} />
      <EmailViewerDialog
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        subject={viewer.subject}
        html={viewer.html}
        sentAt={viewer.sentAt}
      />
    </SitterShell>
  );
}
