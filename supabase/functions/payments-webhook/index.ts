import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { notifyAnnekeOfPaidBooking } from "../_shared/notify-anneke.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const env = ((new URL(req.url)).searchParams.get("env") || "sandbox") as StripeEnv;
  try {
    const event = await verifyWebhook(req, env) as { id?: string; type: string; data: { object: any } };

    // Idempotency: if we've seen this event id before, skip. PK conflict = already processed.
    if (event.id) {
      const { error: dupErr } = await supabase
        .from("processed_stripe_events")
        .insert({ id: event.id, event_type: event.type });
      if (dupErr && (dupErr.code === "23505" || /duplicate/i.test(dupErr.message ?? ""))) {
        console.log("Skipping duplicate event", event.id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    if (event.type === "checkout.session.completed") {
      const session: any = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      // Capture the saved payment method so Anneke can recharge later off-session.
      if (userId && customerId && paymentIntentId) {
        try {
          const stripe = createStripeClient(env);
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
          if (paymentMethodId) {
            await supabase
              .from("profiles")
              .update({ stripe_customer_id: customerId, default_payment_method_id: paymentMethodId })
              .eq("id", userId);
          }
        } catch (err) {
          console.error("Failed to capture saved payment method", err);
        }
      }

      if (bookingId) {
        // Defense-in-depth: if booking is already paid, skip side-effects (receipt, notify).
        const { data: bookingRow } = await supabase
          .from("bookings")
          .select("total_cents, payment_amount_cents, paid_at")
          .eq("id", bookingId)
          .maybeSingle();

        const alreadyPaid = !!(bookingRow as any)?.paid_at;
        const totalCents = (bookingRow as any)?.total_cents ?? (session.amount_total ?? 0);
        const paidCents = session.amount_total ?? totalCents;

        await supabase.from("bookings").update({
          status: "confirmed",
          paid_at: new Date().toISOString(),
          payment_status: "paid",
          payment_amount_cents: paidCents,
          stripe_payment_intent: paymentIntentId ?? null,
          stripe_session_id: session.id,
        }).eq("id", bookingId);

        // Mark related invoice paid — or create one if the booking was paid via
        // the approve→checkout flow (which doesn't pre-create an invoice).
        const invoiceId = session.metadata?.invoiceId;
        let resolvedInvoiceId: string | null = invoiceId ?? null;
        if (!resolvedInvoiceId) {
          const { data: inv } = await supabase.from("invoices")
            .select("id").eq("booking_id", bookingId)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          resolvedInvoiceId = (inv as any)?.id ?? null;
        }
        if (resolvedInvoiceId) {
          await supabase.from("invoices").update({
            status: "paid",
            amount_paid_cents: paidCents,
            paid_at: new Date().toISOString(),
          }).eq("id", resolvedInvoiceId);
        } else {
          // Auto-create a paid invoice so the booking shows up in Anneke's
          // Invoices tab and history. Pull line-item details from the booking.
          const { data: bookingFull } = await supabase
            .from("bookings")
            .select("id, customer_id, sitter_id, base_price_cents, extra_time_fee_cents, late_pickup_fee_cents, total_cents, services(name), service_variants(name)")
            .eq("id", bookingId)
            .maybeSingle();

          if (bookingFull) {
            const b: any = bookingFull;
            const serviceName = b.service_variants?.name ?? b.services?.name ?? "Booking";
            const basePrice = b.base_price_cents ?? (paidCents - (b.extra_time_fee_cents ?? 0) - (b.late_pickup_fee_cents ?? 0));
            const lineItems: { label: string; quantity: number; unit_price_cents: number; total_cents: number; kind: string; sort_order: number }[] = [
              { label: serviceName, quantity: 1, unit_price_cents: basePrice, total_cents: basePrice, kind: "service", sort_order: 0 },
            ];
            if (b.extra_time_fee_cents) {
              lineItems.push({ label: "Extra time", quantity: 1, unit_price_cents: b.extra_time_fee_cents, total_cents: b.extra_time_fee_cents, kind: "extra_time", sort_order: 1 });
            }
            if (b.late_pickup_fee_cents) {
              lineItems.push({ label: "Late pickup fee", quantity: 1, unit_price_cents: b.late_pickup_fee_cents, total_cents: b.late_pickup_fee_cents, kind: "late_fee", sort_order: 2 });
            }
            const subtotal = lineItems.reduce((s, li) => s + li.total_cents, 0);
            const nowIso = new Date().toISOString();

            const { data: createdInv, error: createInvErr } = await supabase
              .from("invoices")
              .insert({
                booking_id: bookingId,
                sitter_id: b.sitter_id,
                customer_id: b.customer_id,
                status: "paid",
                subtotal_cents: subtotal,
                total_cents: subtotal,
                amount_paid_cents: paidCents,
                paid_at: nowIso,
                sent_at: nowIso,
              })
              .select("id")
              .single();

            if (createInvErr) {
              console.error("Auto-create invoice failed", createInvErr);
            } else if (createdInv) {
              resolvedInvoiceId = (createdInv as any).id;
              const itemsToInsert = lineItems.map((li) => ({
                invoice_id: resolvedInvoiceId!,
                label: li.label,
                quantity: li.quantity,
                unit_price_cents: li.unit_price_cents,
                total_cents: li.total_cents,
                kind: li.kind,
                sort_order: li.sort_order,
              }));
              const { error: liErr } = await supabase.from("invoice_line_items").insert(itemsToInsert);
              if (liErr) console.error("Auto-create invoice line items failed", liErr);

              await supabase.from("payment_events").insert({
                invoice_id: resolvedInvoiceId,
                booking_id: bookingId,
                kind: "invoice_created",
                metadata: { auto_created: true, source: "checkout.session.completed" },
              });
            }
          }
        }

        if (!alreadyPaid) {
          await supabase.from("payment_events").insert({
            booking_id: bookingId,
            invoice_id: resolvedInvoiceId,
            kind: "charge_succeeded",
            channel: "stripe",
            amount_cents: paidCents,
            metadata: { stripe_session_id: session.id, stripe_payment_intent: paymentIntentId },
          });

          try {
            await supabase.functions.invoke("send-payment-receipt", {
              body: {
                invoiceId: resolvedInvoiceId ?? undefined,
                bookingId,
                amountPaidCents: paidCents,
                paymentMethod: "Card",
                paidAt: new Date().toISOString(),
              },
            });
          } catch (e) { console.error("receipt email failed", e); }

          await notifyAnnekeOfPaidBooking(bookingId);
        } else {
          console.log("Booking already paid, skipping receipt/notify side-effects", bookingId);
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge: any = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      const refundedAmount: number = charge.amount_refunded ?? 0;
      const totalAmount: number = charge.amount ?? 0;
      const isFullRefund = refundedAmount >= totalAmount;

      if (paymentIntentId) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("id, payment_amount_cents, refund_amount_cents")
          .eq("stripe_payment_intent", paymentIntentId)
          .maybeSingle();

        if (booking) {
          await supabase.from("bookings").update({
            status: isFullRefund ? "refunded" : "confirmed",
            payment_status: isFullRefund ? "refunded" : "partial_refund",
            refund_amount_cents: refundedAmount,
            payment_amount_cents: Math.max(0, ((booking as any).payment_amount_cents ?? totalAmount) - refundedAmount),
          }).eq("id", (booking as any).id);

          await supabase.from("payment_events").insert({
            booking_id: (booking as any).id,
            kind: isFullRefund ? "refund_succeeded" : "partial_refund",
            channel: "stripe",
            amount_cents: refundedAmount,
            metadata: { stripe_payment_intent: paymentIntentId, charge_id: charge.id },
          });
        }
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent: any = event.data.object;
      const bookingId = intent.metadata?.bookingId;
      if (bookingId) {
        await supabase.from("bookings").update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent: intent.id,
          stripe_charge_id: intent.latest_charge ?? null,
        }).eq("id", bookingId);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
