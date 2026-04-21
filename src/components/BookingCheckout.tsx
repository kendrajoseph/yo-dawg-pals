import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface BookingCheckoutProps {
  bookingId: string;
  returnUrl?: string;
}

export function BookingCheckout({ bookingId, returnUrl }: BookingCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { bookingId, environment: getStripeEnvironment(), returnUrl },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to start checkout");
    }
    return data.clientSecret;
  };

  return (
    <div id="checkout" className="border-2 border-primary bg-card">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
