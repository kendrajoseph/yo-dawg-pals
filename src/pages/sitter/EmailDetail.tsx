import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, Star, Archive, Trash2, Reply, Forward, Mail, FileText, Receipt, Bell, MessageSquare,
} from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { MessageComposer } from "@/components/sitter/MessageComposer";
import { TEMPLATE_TO_KIND } from "./Emails";

const KIND_META: Record<string, { label: string; icon: any; className: string }> = {
  invoice:          { label: "Invoice",   icon: FileText,      className: "bg-blue-100 text-blue-800 border-blue-200" },
  receipt:          { label: "Receipt",   icon: Receipt,       className: "bg-green-100 text-green-800 border-green-200" },
  reminder:         { label: "Reminder",  icon: Bell,          className: "bg-amber-100 text-amber-800 border-amber-200" },
  service_update:   { label: "Update",    icon: MessageSquare, className: "bg-purple-100 text-purple-800 border-purple-200" },
  offer:            { label: "Offer",     icon: Mail,          className: "bg-pink-100 text-pink-800 border-pink-200" },
  customer_service: { label: "Message",   icon: MessageSquare, className: "bg-muted text-foreground border-border" },
};

type EmailData = {
  source: "archive" | "log";
  id: string;
  subject: string;
  message: string;
  email_html: string | null;
  kind: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  avatar_url: string | null;
  recipient_email: string | null;
  read_at: string | null;
  starred_at: string | null;
  archived_at: string | null;
};

export default function EmailDetail() {
  const { source, id } = useParams<{ source: "archive" | "log"; id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<{ open: boolean; subject?: string; message?: string; customerId?: string }>({ open: false });

  useEffect(() => {
    if (!user?.id || !source || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let email: EmailData | null = null;

      if (source === "archive") {
        const { data: m } = await supabase.from("client_messages")
          .select("id, subject, message, created_at, customer_id, kind, email_html")
          .eq("id", id).maybeSingle();
        if (m) {
          let customer_name = null, avatar_url = null, recipient_email = null;
          if (m.customer_id) {
            const { data: p } = await supabase.from("profiles")
              .select("full_name, avatar_url").eq("id", m.customer_id).maybeSingle();
            customer_name = (p as any)?.full_name ?? null;
            avatar_url = (p as any)?.avatar_url ?? null;
          }
          email = {
            source: "archive", id: m.id, subject: m.subject, message: m.message,
            email_html: (m as any).email_html ?? null, kind: (m as any).kind ?? "customer_service",
            created_at: m.created_at, customer_id: (m as any).customer_id,
            customer_name, avatar_url, recipient_email,
            read_at: null, starred_at: null, archived_at: null,
          };
        }
      } else {
        const { data: l } = await supabase.from("email_send_log")
          .select("id, template_name, recipient_email, created_at")
          .eq("id", id).maybeSingle();
        if (l) {
          const tpl = TEMPLATE_TO_KIND[(l as any).template_name] ?? { kind: "customer_service", subject: (l as any).template_name };
          email = {
            source: "log", id: (l as any).id, subject: tpl.subject,
            message: `Sent to ${(l as any).recipient_email}`,
            email_html: null, kind: tpl.kind, created_at: (l as any).created_at,
            customer_id: null, customer_name: (l as any).recipient_email,
            avatar_url: null, recipient_email: (l as any).recipient_email,
            read_at: null, starred_at: null, archived_at: null,
          };
        }
      }

      if (email) {
        const { data: st } = await supabase.from("email_user_state")
          .select("read_at, starred_at, archived_at")
          .eq("user_id", user.id).eq("source_type", source).eq("source_id", id).maybeSingle();
        if (st) {
          email.read_at = (st as any).read_at;
          email.starred_at = (st as any).starred_at;
          email.archived_at = (st as any).archived_at;
        }
        // Mark as read on open
        if (!email.read_at) {
          await supabase.from("email_user_state").upsert({
            user_id: user.id, source_type: source, source_id: id,
            read_at: new Date().toISOString(),
            starred_at: email.starred_at, archived_at: email.archived_at,
          }, { onConflict: "user_id,source_type,source_id" });
          email.read_at = new Date().toISOString();
        }
      }

      if (cancelled) return;
      setData(email);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, source, id]);

  const updateState = async (patch: Record<string, string | null>) => {
    if (!user?.id || !source || !id || !data) return;
    setData({ ...data, ...patch } as EmailData);
    const { error } = await supabase.from("email_user_state").upsert({
      user_id: user.id, source_type: source, source_id: id,
      read_at: patch.read_at !== undefined ? patch.read_at : data.read_at,
      starred_at: patch.starred_at !== undefined ? patch.starred_at : data.starred_at,
      archived_at: patch.archived_at !== undefined ? patch.archived_at : data.archived_at,
    }, { onConflict: "user_id,source_type,source_id" });
    if (error) toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
  };

  const handleDelete = async () => {
    if (!data || data.source !== "archive") return;
    const { error } = await supabase.from("client_messages").delete().eq("id", data.id);
    if (error) { toast({ title: "Couldn't delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    navigate("/sitter/emails?tab=sent");
  };

  if (loading) {
    return <SitterShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></SitterShell>;
  }
  if (!data) {
    return (
      <SitterShell>
        <SitterPageHeader back={{ to: "/sitter/emails?tab=sent", label: "Back to emails" }} title="Email not found" />
      </SitterShell>
    );
  }

  const meta = KIND_META[data.kind] ?? KIND_META.customer_service;
  const Icon = meta.icon;

  return (
    <SitterShell>
      <SitterPageHeader back={{ to: "/sitter/emails?tab=sent", label: "Back to emails" }} title={data.subject} />

      <Card className="border border-border p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-start gap-3 border-b border-border pb-4">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={data.avatar_url ?? undefined} />
            <AvatarFallback>{(data.customer_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                <Icon className="h-3 w-3" />{meta.label}
              </Badge>
              {data.customer_id ? (
                <Link to={`/sitter/clients/${data.customer_id}`} className="truncate text-base font-semibold hover:underline">
                  {data.customer_name ?? "Client"}
                </Link>
              ) : (
                <span className="truncate text-base font-semibold text-muted-foreground">{data.customer_name ?? "Client"}</span>
              )}
            </div>
            <div className="mt-1 text-lg font-display">{data.subject}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {format(new Date(data.created_at), "PPpp")}
              {data.recipient_email ? ` · to ${data.recipient_email}` : ""}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!data.customer_id}
            onClick={() => setComposer({ open: true, customerId: data.customer_id ?? undefined,
              subject: data.subject.startsWith("Re:") ? data.subject : `Re: ${data.subject}` })}>
            <Reply className="mr-1.5 h-4 w-4" />Reply
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => setComposer({ open: true,
              subject: data.subject.startsWith("Fwd:") ? data.subject : `Fwd: ${data.subject}`,
              message: `\n\n---------- Forwarded message ----------\nFrom: you\nDate: ${format(new Date(data.created_at), "PPpp")}\nSubject: ${data.subject}\n\n${data.message}` })}>
            <Forward className="mr-1.5 h-4 w-4" />Forward
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => updateState({ starred_at: data.starred_at ? null : new Date().toISOString() })}>
            <Star className={`mr-1.5 h-4 w-4 ${data.starred_at ? "fill-amber-400 text-amber-500" : ""}`} />
            {data.starred_at ? "Unstar" : "Star"}
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => updateState({ read_at: data.read_at ? null : new Date().toISOString() })}>
            <Mail className="mr-1.5 h-4 w-4" />{data.read_at ? "Mark unread" : "Mark read"}
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => {
              updateState({ archived_at: data.archived_at ? null : new Date().toISOString() });
              toast({ title: data.archived_at ? "Restored" : "Archived" });
            }}>
            <Archive className="mr-1.5 h-4 w-4" />{data.archived_at ? "Restore" : "Archive"}
          </Button>
          {data.source === "archive" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 h-4 w-4" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this email?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes it from your hub. The email already delivered to the client is unaffected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {data.email_html ? (
          <iframe
            title={data.subject}
            srcDoc={data.email_html}
            sandbox=""
            className="h-[70vh] w-full rounded-md border border-border bg-white"
          />
        ) : (
          <div className="rounded-md border border-dashed border-border p-6">
            <p className="whitespace-pre-wrap text-sm">{data.message}</p>
            {data.source === "log" && (
              <p className="mt-4 text-xs text-muted-foreground">
                This email was sent before message archiving was enabled, so the rendered HTML isn't stored. The metadata above is from the delivery log.
              </p>
            )}
          </div>
        )}
      </Card>

      <MessageComposer
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        initialCustomerId={composer.customerId}
        initialSubject={composer.subject}
        initialMessage={composer.message}
      />
    </SitterShell>
  );
}
