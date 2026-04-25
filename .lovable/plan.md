## Reconnect Stripe with Anneke's account

You disconnected the previous Stripe integration (tied to Byram's business). We'll re-enable the same BYOK (bring-your-own-key) integration with Anneke's keys so all existing checkout/webhook/refund code keeps working without changes.

### Steps

1. **Enable BYOK Stripe integration** — re-runs the Stripe setup so Lovable knows to expect `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets.

2. **Securely add `STRIPE_SECRET_KEY`** — I'll prompt you with a secure input. Paste Anneke's secret key from [Stripe → Developers → API keys](https://dashboard.stripe.com/apikeys).

3. **Set up the webhook in Anneke's Stripe dashboard** — once the secret key is in, I'll give you:
   - The webhook URL (the `payments-webhook` edge function)
   - The exact event types to subscribe to (e.g. `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, etc.)
   
   You'll create the webhook endpoint in Anneke's Stripe dashboard, then copy the signing secret (`whsec_...`) it generates.

4. **Securely add `STRIPE_WEBHOOK_SECRET`** — I'll prompt you with a secure input for the `whsec_...` value.

5. **Verify connection** — run a quick test against Stripe to confirm the keys work.

6. **Recreate products** — the 5 products (Solo Walk, Group Walk, Boarding, etc.) live in the *previous* Stripe account, not in Anneke's. I'll recreate them on her account using your existing service definitions, so checkout sessions resolve to her price IDs.

### Heads-up

- **Test vs Live keys** — let me know if you want to start with `sk_test_...` (sandbox, no real charges) or go straight to `sk_live_...`. I'd recommend test first to verify the full booking → checkout → webhook flow before flipping to live.
- **Existing pending invoices** — any unpaid invoices/checkout sessions created under the old account will not be payable on the new account. They'll need to be regenerated.
- **Customer payment methods** — saved cards from Byram's Stripe account do NOT transfer to Anneke's account. Customers will be prompted to re-enter cards on their next booking.

### Technical scope (for reference)

No code changes needed — the existing edge functions (`create-checkout`, `payments-webhook`, `charge-saved-card`, `refund-payment`, `create-invoice`, `pay-invoice-public`) already read `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the environment. Swapping the secret values is sufficient.
