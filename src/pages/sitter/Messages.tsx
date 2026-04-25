import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search, Plus, Trash2 } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageComposer } from "@/components/sitter/MessageComposer";
import { toast } from "@/hooks/use-toast";

type Thread = {
  customer_id: string;
  customer_name: string | null;
  avatar_url: string | null;
  last_subject: string;
  last_message: string;
  last_at: string;
  count: number;
  unread: boolean;
};

export default function SitterMessages() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteThread = async (customerId: string) => {
    if (!user?.id) return;
    setDeletingId(customerId);
    const { error } = await supabase
      .from("client_messages")
      .delete()
      .eq("sitter_id", user.id)
      .eq("customer_id", customerId);
    setDeletingId(null);
    if (error) {
      toast({ title: "Couldn't delete conversation", description: error.message, variant: "destructive" });
      return;
    }
    setThreads((prev) => prev.filter((t) => t.customer_id !== customerId));
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("client_messages")
        .select("id, subject, message, created_at, customer_id")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load client messages", error);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
      let profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (customerIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", customerIds);
        profilesMap = new Map((profileRows ?? []).map((p: any) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
      }
      const grouped = new Map<string, Thread>();
      for (const m of rows) {
        const profile = profilesMap.get(m.customer_id);
        const existing = grouped.get(m.customer_id);
        if (!existing) {
          grouped.set(m.customer_id, {
            customer_id: m.customer_id,
            customer_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            last_subject: m.subject,
            last_message: m.message,
            last_at: m.created_at,
            count: 1,
            unread: false,
          });
        } else {
          existing.count += 1;
        }
      }
      setThreads([...grouped.values()].sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at)));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, reloadKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter((t) =>
      (t.customer_name ?? "").toLowerCase().includes(q) ||
      t.last_subject.toLowerCase().includes(q) ||
      t.last_message.toLowerCase().includes(q),
    );
  }, [threads, search]);

  return (
    <SitterShell action={
      <Button size="sm" onClick={() => setComposeOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Compose</Button>
    }>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">Messages</h1>
        <p className="text-sm text-muted-foreground">Conversations with your clients.</p>
      </div>

      <Card className="border border-border p-4 shadow-soft">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages" className="pl-8" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="No conversations yet"
            description="Messages you send to clients will appear here."
            action={<Button size="sm" onClick={() => setComposeOpen(true)}>Compose your first</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.customer_id} className="flex items-center gap-1">
                <Link to={`/sitter/clients/${t.customer_id}`} className="flex flex-1 items-center gap-3 px-2 py-3 transition-colors hover:bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={t.avatar_url ?? undefined} />
                    <AvatarFallback>{(t.customer_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{t.customer_name ?? "Client"}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(t.last_at), { addSuffix: true })}</span>
                    </div>
                    <div className="truncate text-sm">{t.last_subject}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.last_message}</div>
                  </div>
                  <Badge variant="outline">{t.count}</Badge>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === t.customer_id}
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove all {t.count} message{t.count === 1 ? "" : "s"} with {t.customer_name ?? "this client"} from your hub. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteThread(t.customer_id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MessageComposer open={composeOpen} onOpenChange={setComposeOpen} onSent={() => setReloadKey((k) => k + 1)} />
    </SitterShell>
  );
}
