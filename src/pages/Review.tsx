import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeaveReviewDialog } from "@/components/LeaveReviewDialog";
import { Button } from "@/components/ui/button";

export default function Review() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const db = supabase as any;
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bookingId) return;
      const { data, error } = await db
        .from("bookings")
        .select("id, customer_id, sitter_id, service_id, services(name), pets(name)")
        .eq("id", bookingId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setError("We couldn't find this booking.");
      } else {
        setBooking(data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId, db]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  if (error || !booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl">Review unavailable</h1>
        <p className="text-muted-foreground">{error ?? "Please sign in with the same account you booked with."}</p>
        <Button asChild><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-md text-center space-y-2">
        <h1 className="font-display text-3xl">Leave a review</h1>
        <p className="text-muted-foreground">Thanks for booking with Yo Dawg! Your feedback helps us improve.</p>
      </div>
      <LeaveReviewDialog
        defaultOpen
        bookingId={booking.id}
        customerId={booking.customer_id}
        sitterId={booking.sitter_id}
        serviceLabel={booking.services?.name ?? "Your service"}
        petName={booking.pets?.name}
        onSubmitted={() => navigate("/account")}
        triggerLabel="Open review"
      />
      <Button variant="ghost" asChild><Link to="/account">Back to account</Link></Button>
    </div>
  );
}
