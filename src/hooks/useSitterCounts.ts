import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SitterCounts = {
  inbox: number;       // requests + pending pet approvals + unread messages
  invoices: number;    // outstanding + overdue + partial
  messages: number;    // unread inbound
  loading: boolean;
};

const ZERO: SitterCounts = { inbox: 0, invoices: 0, messages: 0, loading: true };

export function useSitterCounts(): SitterCounts {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SitterCounts>(ZERO);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      const sitterId = user.id;
      const [requestsRes, approvalsRes, invoicesRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("sitter_id", sitterId).eq("status", "requested"),
        supabase.from("pet_fit_alerts").select("id", { count: "exact", head: true })
          .eq("is_resolved", false),
        supabase.from("invoices").select("id", { count: "exact", head: true })
          .eq("sitter_id", sitterId).in("status", ["sent", "overdue", "partial"]),
      ]);

      if (cancelled) return;
      setCounts({
        inbox: (requestsRes.count ?? 0) + (approvalsRes.count ?? 0),
        invoices: invoicesRes.count ?? 0,
        messages: 0,
        loading: false,
      });
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]);

  return counts;
}
