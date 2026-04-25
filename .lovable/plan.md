## Switching to Anneke's new Stripe account

You're using **Lovable's built-in Stripe payments** (managed integration through the gateway — no API keys stored in code). To switch which Stripe account it's pointed at, the change happens in the **Payments tab**, not by pasting an API key here. Here's exactly what we'll do.

## Good news first

I checked your data:
- **0 paid invoices** in the database
- **No active subscriptions** (you're not on a subscription model — invoices only)
- The current Stripe account hasn't processed any real money through the app yet

That means switching is low-risk. Nothing to migrate.

## What you actually need to do (in the Payments tab)

You can't paste a new API key into the built-in integration — that would be the legacy "BYOK" path, which I'm specifically *not* recommending because you'd lose the managed webhooks, automatic go-live flow, and tax/compliance handling.

Instead:

1. **Open the Payments tab** in Lovable (left sidebar).
2. **Disconnect the current Stripe connection** (Byram's account).
3. **Re-enable Stripe payments** — this provisions a fresh sandbox tied to your workspace.
4. **Click "Claim sandbox"** and, on the Stripe-hosted page that opens, **sign in to Anneke's new Stripe account** (instead of creating a new one).
5. **Complete go-live** on Anneke's account: business verification, bank details, 2FA, then submit. Stripe will offer to copy products/prices/the Lovable app from sandbox to live — accept and **make sure "Lovable" app is included**.
6. Lovable then auto-provisions live keys (`STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET`) and updates the gateway connection. No code change needed.

## What I need to do on the code/data side

Almost nothing — but a few cleanups while we're at it:

1. **Verify no orphaned Stripe references.** I'll scan `payments-webhook`, `create-checkout`, `pay-invoice-public`, `charge-saved-card`, `refund-payment`, and `cancel-booking` to confirm they all use `createStripeClient(env)` from the shared utility (so they automatically pick up the new account once the gateway is re-pointed). No hardcoded customer IDs or product IDs.
2. **Re-create products & prices on the new Stripe account.** Any products/prices created against Byram's account live in *that* Stripe account and won't exist in Anneke's. I'll list what's referenced in the codebase (e.g. invoice line item products, any subscription prices) and recreate them via the `payments` tools after you complete go-live. Since no one has paid yet, no `lookup_key` collisions to worry about.
3. **Confirm webhook routing.** Built-in payments registers `payments-webhook?env=sandbox` and `?env=live` automatically against the new account on re-connect — I'll verify the function is deployed and the secret env vars resolve.
4. **Tax & compliance question (after go-live).** Once Anneke's account is live, I'll ask whether she wants Stripe to handle full tax compliance (+3.5% per transaction, covers ~80 buyer countries) or just tax calculation only (+0.5%). Canada is a supported seller country, so both options are available.

## What WON'T work / things to be aware of

- **Don't share Anneke's secret key with me.** I don't need it and shouldn't store it. The built-in integration uses gateway connection identifiers, not real `sk_live_...` keys.
- **The current `STRIPE_LIVE_API_KEY` and `PAYMENTS_LIVE_WEBHOOK_SECRET` secrets** will be overwritten automatically by Lovable when you complete the new go-live. Don't touch them manually.
- **Saved cards / Stripe customers from Byram's account** can't be migrated. None exist yet, so this isn't an issue today.
- **Anything you tested in the old sandbox** (test products, test prices, test invoices in Stripe dashboard) stays in Byram's Stripe account. The data in *this app's* database (invoices, bookings, etc.) is unaffected — that's all in Lovable Cloud, separate from Stripe.

## Order of operations

```text
1. You: Payments tab → disconnect current Stripe
2. You: Re-enable Stripe payments → claim → sign in as Anneke
3. You: Complete Stripe go-live form on Anneke's account
4. Lovable: auto-provisions new live keys (wait ~1 min)
5. Me: verify edge functions, recreate products/prices on new account
6. Me: ask about tax/compliance handling preference
7. You: test a real $1 invoice end-to-end to confirm payout lands in Anneke's bank
```

## Files I'll touch (after you complete steps 1–4)

- No `src/` changes expected — the gateway abstraction means our app code doesn't change.
- Possible: a one-time setup script run via `payments--batch_create_product` + `payments--create_price` to recreate any products on the new account.
- Possible: `supabase/functions/_shared/stripe.ts` audit (read-only, I expect no changes).

Approve this and I'll wait for you to complete steps 1–4 in the Payments tab, then take it from there.