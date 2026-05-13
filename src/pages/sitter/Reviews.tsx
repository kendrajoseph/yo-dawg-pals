import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBookingSchedule } from "@/lib/booking";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  customer_id: string;
  booking_id: string;
};

type BookingRef = {
  id: string;
  start_at: string;
  end_at: string;
  scheduled_start_at: string | null;
  requested_date: string | null;
  requested_window_label: string | null;
  booking_kind: string | null;
  services: { name: string } | null;
  service_variants: { name: string } | null;
  pets: { name: string } | null;
};

type ProfileRef = { id: string; full_name: string | null };

export default function SitterReviews() {
  const db = supabase as any;
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [bookings, setBookings] = useState<Record<string, BookingRef>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRef>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: reviewData } = await db
        .from("client_reviews")
        .select("id, rating, comment, is_anonymous, created_at, customer_id, booking_id")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false });
      const list = (reviewData ?? []) as ReviewRow[];

      const bookingIds = Array.from(new Set(list.map((r) => r.booking_id)));
      const customerIds = Array.from(new Set(list.filter((r) => !r.is_anonymous).map((r) => r.customer_id)));

      const [{ data: bookingData }, { data: profileData }] = await Promise.all([
        bookingIds.length
          ? db
              .from("bookings")
              .select("id, start_at, end_at, scheduled_start_at, requested_date, requested_window_label, booking_kind, services(name), service_variants(name), pets(name)")
              .in("id", bookingIds)
          : Promise.resolve({ data: [] }),
        customerIds.length
          ? db.from("profiles").select("id, full_name").in("id", customerIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setBookings(Object.fromEntries(((bookingData ?? []) as BookingRef[]).map((b) => [b.id, b])));
      setProfiles(Object.fromEntries(((profileData ?? []) as ProfileRef[]).map((p) => [p.id, p])));
      setReviews(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, db]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((a, r) => a + r.rating, 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1] += 1; });
    return counts; // index 0 = 1 star … index 4 = 5 stars
  }, [reviews]);

  return (
    <SitterShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <header>
          <h1 className="font-display text-3xl uppercase text-primary">Client reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private feedback from clients after completed services. Only you can see this.</p>
        </header>

        <Card className="border-4 border-primary p-5 shadow-pop sm:p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet — clients can leave a rating once a booking is marked completed.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
              <div className="text-center">
                <div className="font-display text-5xl text-clay">{stats.avg.toFixed(1)}</div>
                <StarRating value={Math.round(stats.avg)} readOnly className="mt-1 justify-center" />
                <div className="mt-1 text-xs uppercase text-muted-foreground">{stats.count} review{stats.count === 1 ? "" : "s"}</div>
              </div>
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = distribution[star - 1];
                  const pct = stats.count ? (c / stats.count) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-6 font-display">{star}★</span>
                      <div className="h-2 flex-1 overflow-hidden bg-muted">
                        <div className="h-full bg-tag" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          {reviews.map((r) => {
            const b = bookings[r.booking_id];
            const profile = profiles[r.customer_id];
            const name = r.is_anonymous ? "Anonymous client" : profile?.full_name || "Client";
            const serviceLabel = b?.service_variants?.name ?? b?.services?.name ?? "Service";
            return (
              <article key={r.id} className="border-4 border-primary bg-card p-4 shadow-pop">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg uppercase">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {serviceLabel}{b?.pets?.name ? ` · ${b.pets.name}` : ""}{b ? ` · ${formatBookingSchedule(b as any)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating value={r.rating} readOnly size="sm" />
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {r.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{r.comment}</p>}
                {!r.comment && <p className="mt-3 text-sm italic text-muted-foreground">No written comment.</p>}
              </article>
            );
          })}
        </div>
      </div>
    </SitterShell>
  );
}
