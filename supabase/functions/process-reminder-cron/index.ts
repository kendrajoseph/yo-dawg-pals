// Daily cron: finds outstanding invoices and triggers reminders per cadence.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: settingsRows } = await admin.from("reminder_settings").select("*").eq("auto_enabled", true);
    if (!settingsRows || settingsRows.length === 0) return json({ ok: true, processed: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let processed = 0;

    for (const s of settingsRows as any[]) {
      const cadence = s.cadence ?? {};
      const beforeDays: number[] = cadence.before_due_days ?? [3];
      const onDue: boolean = cadence.on_due ?? true;
      const afterDays: number[] = cadence.after_due_days ?? [3, 7];
      const tone: "friendly" | "firm" | "final" = s.default_tone ?? "friendly";

      const { data: invoices } = await admin.from("invoices")
        .select("id, due_date, status, sitter_id")
        .eq("sitter_id", s.sitter_id)
        .in("status", ["sent", "overdue", "partial"]);

      for (const inv of (invoices ?? []) as any[]) {
        if (!inv.due_date) continue;
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

        let trigger = false;
        let pickedTone = tone;
        if (diffDays < 0 && beforeDays.includes(-diffDays)) trigger = true;
        else if (diffDays === 0 && onDue) trigger = true;
        else if (diffDays > 0 && afterDays.includes(diffDays)) {
          trigger = true;
          if (diffDays >= 7) pickedTone = "final";
          else if (diffDays >= 3) pickedTone = "firm";
        }
        if (!trigger) continue;

        // Skip if a reminder was already sent today
        const startOfDay = new Date(today).toISOString();
        const { data: alreadySent } = await admin.from("payment_events")
          .select("id").eq("invoice_id", inv.id).eq("kind", "reminder_sent")
          .gte("created_at", startOfDay).limit(1).maybeSingle();
        if (alreadySent) continue;

        try {
          await admin.functions.invoke("send-payment-reminder", {
            body: { invoiceId: inv.id, tone: pickedTone, channel: "email", triggeredByCron: true },
          });
          processed++;
        } catch (e) { console.error("cron reminder failed", inv.id, e); }
      }
    }

    return json({ ok: true, processed });
  } catch (e: any) {
    console.error("process-reminder-cron error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
