import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Receipt, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/invoices";
import { format } from "date-fns";
import { getStripeEnvironment } from "@/lib/stripe";

type PaymentEvent = {
  id: string;
  kind: string;
  channel: string | null;
  amount_cents: number | null;
  created_at: string;
  booking_id: string | null;
};

const KIND_LABELS: Record<string, string> = {
  charge_succeeded: "Payment received",
  refund_succeeded: "Refund issued",
  partial_refund: "Partial refund",
  charge_failed: "Payment failed",
};

export function PaymentSettings() {
  const { user } = useAuth();
  const db = supabase as any;
  const [hasCard, setHasCard] = useState(false);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: profile }, { data: evts }] = await Promise.all([
      db.from("profiles").select("default_payment_method_id").eq("id", user.id).maybeSingle(),
      db.from("payment_events").select("id, kind, channel, amount_cents, created_at, booking_id").order("created_at", { ascending: false }).limit(20),
    ]);
    setHasCard(!!profile?.default_payment_method_id);
    setEvents((evts ?? []) as PaymentEvent[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user]);

  const removeCard = async () => {
    setRemoving(true);
    const { error } = await supabase.functions.invoke("remove-saved-card", {
      body: { environment: getStripeEnvironment() },
    });
    setRemoving(false);
    if (error) {
      toast({ title: "Couldn't remove card", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Card removed", description: "Your saved card was removed." });
    void load();
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="font-display uppercase text-primary">Saved payment method</h3>
        </div>
        {hasCard ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">A card is on file for fast checkout and balance charges.</p>
            <Button variant="outline" size="sm" onClick={removeCard} disabled={removing}>
              <Trash2 className="mr-1 h-4 w-4" />
              {removing ? "Removing…" : "Remove card"}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No card saved. One will be saved automatically the next time you check out.</p>
        )}
      </Card>

      <Card className="border-2 border-primary p-5">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="font-display uppercase text-primary">Payment history</h3>
        </div>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-display uppercase text-primary">{KIND_LABELS[e.kind] ?? e.kind}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy · h:mm a")}</p>
                </div>
                <div className={e.kind.includes("refund") ? "text-amber-700" : "text-foreground"}>
                  {e.kind.includes("refund") ? "− " : ""}{formatCents(e.amount_cents ?? 0)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
