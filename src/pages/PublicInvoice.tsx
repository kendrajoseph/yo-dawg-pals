import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { formatCents } from "@/lib/invoices";
import { PublicInvoiceCheckout } from "@/components/PublicInvoiceCheckout";

type LineItem = {
  id: string;
  label: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

type InvoiceData = {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    subtotal_cents: number;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string | null;
    notes: string | null;
    public_token: string;
    created_at: string;
  };
  line_items: LineItem[];
  sitter_name: string | null;
  customer_name: string | null;
};

const PublicInvoice = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: result, error: rpcErr } = await supabase.rpc("get_public_invoice", { _token: token });
      if (rpcErr) throw rpcErr;
      if (!result) {
        setError("Invoice not found or no longer available.");
      } else {
        setData(result as unknown as InvoiceData);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  const startPay = () => {
    setPaying(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading invoice…
          </div>
        )}

        {!loading && error && (
          <Card className="p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-3 font-display text-xl uppercase text-primary">Couldn't load invoice</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        )}

        {!loading && data && (
          <>
            {status === "paid" && (
              <Card className="mb-4 border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-display uppercase">Payment received — thank you!</p>
                </div>
              </Card>
            )}
            {status === "cancelled" && (
              <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-amber-800">
                <p className="font-display uppercase">Payment was cancelled. You can try again below.</p>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Invoice</p>
                  <h1 className="font-display text-2xl uppercase text-primary">{data.invoice.invoice_number}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">From {data.sitter_name ?? "Yo Dawg"}</p>
                  {data.customer_name && <p className="text-sm text-muted-foreground">For {data.customer_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase text-muted-foreground">Issued</p>
                  <p className="text-sm">{format(new Date(data.invoice.created_at), "MMM d, yyyy")}</p>
                  {data.invoice.due_date && (
                    <>
                      <p className="mt-1 text-[11px] uppercase text-muted-foreground">Due</p>
                      <p className="text-sm">{format(new Date(data.invoice.due_date + "T12:00:00"), "MMM d, yyyy")}</p>
                    </>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <ul className="space-y-2">
                {data.line_items.map((li) => (
                  <li key={li.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-display uppercase text-primary">{li.label}</p>
                      {Number(li.quantity) !== 1 && (
                        <p className="text-xs text-muted-foreground">
                          {li.quantity} × {formatCents(li.unit_price_cents)}
                        </p>
                      )}
                    </div>
                    <div>{formatCents(li.total_cents)}</div>
                  </li>
                ))}
              </ul>

              <Separator className="my-4" />

              <div className="space-y-1 text-right text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCents(data.invoice.subtotal_cents)}</span></div>
                {data.invoice.amount_paid_cents > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>− {formatCents(data.invoice.amount_paid_cents)}</span></div>
                )}
                <div className="flex justify-between font-display text-lg uppercase text-primary">
                  <span>Amount due</span>
                  <span>{formatCents(Math.max(0, data.invoice.total_cents - data.invoice.amount_paid_cents))}</span>
                </div>
              </div>

              {data.invoice.notes && (
                <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{data.invoice.notes}</p>
              )}

              {data.invoice.status !== "paid" && data.invoice.amount_paid_cents < data.invoice.total_cents && (
                <>
                  {!paying && token && (
                    <Button onClick={startPay} className="mt-6 w-full font-display uppercase">
                      Pay {formatCents(data.invoice.total_cents - data.invoice.amount_paid_cents)}
                    </Button>
                  )}
                  {paying && token && (
                    <div className="mt-6">
                      <PublicInvoiceCheckout token={token} />
                    </div>
                  )}
                </>
              )}
            </Card>
          </>
        )}
      </section>
      <SiteFooter />
    </div>
  );
};

export default PublicInvoice;
