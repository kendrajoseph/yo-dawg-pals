import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Mail, Phone, User, AlertTriangle, Check } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type Recipient = {
  email: string | null;
  phone: string | null;
  full_name: string | null;
  sent_at: string | null;
};

export function RecipientCard({ invoiceId, fallbackName }: { invoiceId: string | null; fallbackName?: string }) {
  const [data, setData] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    supabase.functions
      .invoke("get-invoice-recipient", { body: { invoiceId } })
      .then(({ data }) => setData((data as Recipient) ?? null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (!invoiceId) return null;

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</div>
        {data?.sent_at ? (
          <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Sent {format(new Date(data.sent_at), "MMM d, h:mm a")}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Not sent yet</div>
        )}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{data?.full_name ?? fallbackName ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {loading ? (
            <span className="text-muted-foreground">Loading…</span>
          ) : data?.email ? (
            <a className="underline hover:no-underline" href={`mailto:${data.email}`}>{data.email}</a>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> No email on file — invoice can't be emailed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          {data?.phone ? (
            <a className="underline hover:no-underline" href={`tel:${data.phone}`}>{data.phone}</a>
          ) : (
            <span className="text-muted-foreground">No phone on file</span>
          )}
        </div>
      </div>
    </Card>
  );
}
