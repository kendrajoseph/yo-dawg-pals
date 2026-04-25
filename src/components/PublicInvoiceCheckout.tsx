import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface PublicInvoiceCheckoutProps {
  token: string;
}

export function PublicInvoiceCheckout({ token }: PublicInvoiceCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("pay-invoice-public", {
      body: {
        token,
        environment: getStripeEnvironment(),
        returnOrigin: window.location.origin,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to start checkout");
    }
    return data.clientSecret;
  };

  return (
    <div id="invoice-checkout" className="border-2 border-primary bg-card">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
