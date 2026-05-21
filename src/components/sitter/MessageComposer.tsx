import { useEffect, useMemo, useState } from "react";
import { Mail, Send, Smartphone, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Client = { id: string; full_name: string | null; mobile_phone: string | null; sms_opt_in: boolean };
type Booking = { id: string; customer_id: string; services: { name: string } | null; pets: { name: string } | null };

export function MessageComposer({
  open,
  onOpenChange,
  initialCustomerId,
  initialSubject,
  initialMessage,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: string;
  initialSubject?: string;
  initialMessage?: string;
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const [audience, setAudience] = useState<"single" | "broadcast">("single");
  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [bookingId, setBookingId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [kind, setKind] = useState<"customer_service" | "service_update" | "offer">("customer_service");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    setCustomerId(initialCustomerId ?? "");
    setSubject(initialSubject ?? "");
    setMessage(initialMessage ?? "");
    let cancelled = false;
    (async () => {
      // unique clients = profiles for any customer with a booking with this sitter
      const { data: bs } = await supabase
        .from("bookings")
        .select("id, customer_id, services(name), pets(name)")
        .eq("sitter_id", user.id);
      if (cancelled) return;
      const bookings = (bs ?? []) as any[] as Booking[];
      setBookings(bookings);
      const ids = [...new Set(bookings.map((b) => b.customer_id))];
      if (ids.length === 0) { setClients([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, mobile_phone, sms_opt_in")
        .in("id", ids);
      if (cancelled) return;
      setClients(((profs ?? []) as Client[]).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")));
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, initialCustomerId]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === customerId) ?? null, [clients, customerId]);
  const clientBookings = useMemo(() => bookings.filter((b) => b.customer_id === customerId), [bookings, customerId]);
  const smsCapableCount = useMemo(() => clients.filter((c) => c.sms_opt_in && c.mobile_phone).length, [clients]);

  const reset = () => {
    setSubject(""); setMessage(""); setBookingId(""); setGroupIds([]);
  };

  const send = async () => {
    const recipients = audience === "broadcast" ? groupIds : [customerId].filter(Boolean);
    if (recipients.length === 0) return toast({ title: "Pick at least one recipient", variant: "destructive" });
    if (!subject.trim() || !message.trim()) return toast({ title: "Add a subject and message", variant: "destructive" });
    if (!sendEmail && !sendSms) {
      // in-app only is OK — backend always logs
    }

    setSending(true);
    const results = await Promise.all(recipients.map(async (cid) => {
      const bId = audience === "single" && cid === customerId ? bookingId || undefined : undefined;
      const r = await supabase.functions.invoke("send-client-message", {
        body: { customerId: cid, bookingId: bId, kind, subject, message, sendEmail, sendSms },
      });
      return r;
    }));
    setSending(false);

    const fails = results.filter((r) => r.error || (r.data as any)?.ok === false);
    if (fails.length > 0) {
      toast({ title: `${fails.length} of ${recipients.length} messages failed`, description: fails[0]?.error?.message ?? (fails[0]?.data as any)?.error ?? "Try again.", variant: "destructive" });
      return;
    }
    toast({ title: audience === "broadcast" ? `Sent to ${recipients.length} clients` : "Message sent" });
    reset();
    onSent?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Compose message</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 rounded-md border border-border bg-muted/40 p-1">
          {(["single", "broadcast"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAudience(a)} className={cn("rounded-md px-3 py-2 text-sm font-display uppercase", audience === a ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}>
              {a === "single" ? "One client" : "Broadcast"}
            </button>
          ))}
        </div>

        {audience === "single" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setBookingId(""); }}>
                <option value="">Select client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}</option>)}
              </select>
            </div>
            <div>
              <Label>Related booking (optional)</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingId} onChange={(e) => setBookingId(e.target.value)} disabled={!customerId}>
                <option value="">General account note</option>
                {clientBookings.map((b) => <option key={b.id} value={b.id}>{b.services?.name} · {b.pets?.name ?? "Pet"}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <Label className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />Recipients ({groupIds.length}/{clients.length})</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setGroupIds(clients.map((c) => c.id))}>Select all</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setGroupIds([])}>Clear</Button>
              </div>
            </div>
            <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-input bg-background p-2">
              {clients.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No clients yet.</p> : clients.map((c) => {
                const checked = groupIds.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={(v) => setGroupIds((g) => v === true ? [...new Set([...g, c.id])] : g.filter((x) => x !== c.id))} />
                    <span className="flex-1 truncate">{c.full_name ?? "Unnamed"}</span>
                    {c.sms_opt_in && c.mobile_phone && <Smartphone className="h-3 w-3 text-muted-foreground" />}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Type</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="customer_service">Customer service</option>
              <option value="service_update">Service update</option>
              <option value="offer">Client offer</option>
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Message</Label>
          <Textarea value={message} maxLength={1200} onChange={(e) => setMessage(e.target.value)} className="min-h-32" />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /> <Mail className="h-4 w-4 text-clay" /> Email</label>
          <label className="flex items-center gap-2"><Checkbox checked={sendSms} onCheckedChange={(v) => setSendSms(v === true)} /> <Smartphone className="h-4 w-4 text-clay" /> SMS</label>
          <span className="text-xs text-muted-foreground">In-app delivery is always included.</span>
        </div>

        {audience === "single" && selectedClient && sendSms ? (
          <p className="text-xs text-muted-foreground">
            {selectedClient.sms_opt_in && selectedClient.mobile_phone
              ? `${selectedClient.full_name} can receive texts at ${selectedClient.mobile_phone}.`
              : `${selectedClient.full_name ?? "This client"} hasn't added a mobile number or opted in — SMS will be skipped.`}
          </p>
        ) : audience === "broadcast" && sendSms ? (
          <p className="text-xs text-muted-foreground">{smsCapableCount} of {groupIds.length || clients.length} recipients have SMS enabled. Others will receive email and in-app only.</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending}><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
