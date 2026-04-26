import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, endOfWeek, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, MapPin, Filter, Calendar as CalendarIcon, Info } from "lucide-react";

import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ---- Leaflet default marker icon fix (CDN-based, no asset bundling needed) ----
const baseIcon = (color: string) =>
  L.divIcon({
    className: "yodawg-marker",
    html: `<div style="
      background:${color};
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid white;
      box-shadow:0 2px 4px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:700;">●</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

const numberedIcon = (color: string, n: number) =>
  L.divIcon({
    className: "yodawg-marker-num",
    html: `<div style="
      background:${color};
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid white;
      box-shadow:0 2px 4px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:white;font-size:13px;font-weight:700;">${n}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

const COLOR_CONFIRMED = "#16a34a"; // emerald
const COLOR_REQUESTED = "#f59e0b"; // amber
const COLOR_OTHER = "#6b7280";

type TimeframeKey = "today" | "tomorrow" | "this_week" | "next_week" | "morning" | "afternoon" | "evening" | "custom";
type StatusKey = "both" | "confirmed" | "requested";

type BookingPin = {
  id: string;
  status: string;
  serviceName: string | null;
  petName: string | null;
  customerName: string | null;
  customerId: string;
  scheduledStart: string | null;
  requestedDate: string | null;
  requestedWindowLabel: string | null;
  windowStartMinute: number | null;
  windowEndMinute: number | null;
  lat: number;
  lng: number;
  addressLine: string;
  isConfirmed: boolean;
};

const CONFIRMED_STATUSES = new Set(["confirmed", "completed", "awaiting_payment"]);
const REQUESTED_STATUSES = new Set(["requested"]);

function FitBounds({ pins }: { pins: BookingPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 14 });
  }, [pins, map]);
  return null;
}

function eventDate(b: BookingPin): Date | null {
  const iso = b.scheduledStart ?? b.requestedDate;
  if (!iso) return null;
  // requested_date is yyyy-MM-dd (no time) — make sure it's parsed in local TZ
  if (iso.length === 10) return parseISO(`${iso}T12:00:00`);
  return parseISO(iso);
}

function inTimeframe(b: BookingPin, timeframe: TimeframeKey, customDate: string): boolean {
  const d = eventDate(b);
  if (!d) return timeframe === "today" ? false : true; // unscheduled bookings: only show in week views

  const now = new Date();
  if (timeframe === "today") return isSameDay(d, now);
  if (timeframe === "tomorrow") return isSameDay(d, addDays(now, 1));
  if (timeframe === "this_week") {
    const s = startOfWeek(now, { weekStartsOn: 1 });
    const e = endOfWeek(now, { weekStartsOn: 1 });
    return d >= s && d <= e;
  }
  if (timeframe === "next_week") {
    const s = startOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    const e = endOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    return d >= s && d <= e;
  }
  if (timeframe === "custom") {
    if (!customDate) return false;
    return isSameDay(d, parseISO(`${customDate}T12:00:00`));
  }

  // Time-block views: today + within window
  if (!isSameDay(d, now)) return false;
  // Block ranges (minutes from midnight)
  const blocks: Record<string, [number, number]> = {
    morning: [5 * 60, 12 * 60],
    afternoon: [12 * 60, 17 * 60],
    evening: [17 * 60, 22 * 60],
  };
  const [start, end] = blocks[timeframe] ?? [0, 24 * 60];

  // Prefer scheduled_start_at; fall back to requested window center
  let mins: number | null = null;
  if (b.scheduledStart) {
    const sd = parseISO(b.scheduledStart);
    mins = sd.getHours() * 60 + sd.getMinutes();
  } else if (b.windowStartMinute != null && b.windowEndMinute != null) {
    mins = Math.round((b.windowStartMinute + b.windowEndMinute) / 2);
  } else if (b.windowStartMinute != null) {
    mins = b.windowStartMinute;
  }
  if (mins == null) return false;
  return mins >= start && mins < end;
}

function statusColor(b: BookingPin) {
  if (b.isConfirmed) return COLOR_CONFIRMED;
  if (REQUESTED_STATUSES.has(b.status)) return COLOR_REQUESTED;
  return COLOR_OTHER;
}

export default function SitterMap() {
  const { user } = useAuth();
  const [pins, setPins] = useState<BookingPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingAddress, setMissingAddress] = useState<Array<{ id: string; customerName: string | null; serviceName: string | null }>>([]);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("today");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("both");
  const [customDate, setCustomDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      const allStatuses = [
        "requested",
        "awaiting_payment",
        "confirmed",
      ] as const;

      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, status, customer_id, scheduled_start_at, requested_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, services(name), pets(name)",
        )
        .eq("sitter_id", user.id)
        .in("status", allStatuses)
        .order("scheduled_start_at", { ascending: true, nullsFirst: false });

      if (cancelled) return;
      if (error) {
        console.error("[SitterMap] booking fetch failed", error);
        setLoading(false);
        return;
      }

      const bookings = data ?? [];
      const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id)));
      let profileMap = new Map<string, any>();
      if (customerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, address_line1, city, address_lat, address_lng")
          .in("id", customerIds);
        profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      }

      const mapped: BookingPin[] = [];
      const missing: typeof missingAddress = [];
      for (const b of bookings) {
        const prof = profileMap.get(b.customer_id);
        const status = b.status as string;
        const isConfirmed = CONFIRMED_STATUSES.has(status);
        if (prof?.address_lat && prof?.address_lng) {
          mapped.push({
            id: b.id,
            status,
            isConfirmed,
            serviceName: (b.services as any)?.name ?? null,
            petName: (b.pets as any)?.name ?? null,
            customerName: prof.full_name ?? null,
            customerId: b.customer_id,
            scheduledStart: (b.scheduled_start_at as string | null) ?? null,
            requestedDate: (b.requested_date as string | null) ?? null,
            requestedWindowLabel: (b.requested_window_label as string | null) ?? null,
            windowStartMinute: (b.requested_window_start_minute as number | null) ?? null,
            windowEndMinute: (b.requested_window_end_minute as number | null) ?? null,
            lat: prof.address_lat,
            lng: prof.address_lng,
            addressLine: [prof.address_line1, prof.city].filter(Boolean).join(", "),
          });
        } else {
          missing.push({
            id: b.id,
            customerName: prof?.full_name ?? null,
            serviceName: (b.services as any)?.name ?? null,
          });
        }
      }
      setPins(mapped);
      setMissingAddress(missing);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (statusFilter === "confirmed" && !p.isConfirmed) return false;
      if (statusFilter === "requested" && !REQUESTED_STATUSES.has(p.status)) return false;
      return inTimeframe(p, timeframe, customDate);
    });
  }, [pins, timeframe, statusFilter, customDate]);

  // For day-style views, sort by time so we can number them in route order
  const isOrderableView =
    timeframe === "today" ||
    timeframe === "tomorrow" ||
    timeframe === "morning" ||
    timeframe === "afternoon" ||
    timeframe === "evening" ||
    timeframe === "custom";

  const orderedPins = useMemo(() => {
    if (!isOrderableView) return filteredPins;
    return [...filteredPins].sort((a, b) => {
      const da = eventDate(a)?.getTime() ?? 0;
      const db = eventDate(b)?.getTime() ?? 0;
      return da - db;
    });
  }, [filteredPins, isOrderableView]);

  const counts = useMemo(() => {
    const confirmed = filteredPins.filter((p) => p.isConfirmed).length;
    const requested = filteredPins.filter((p) => REQUESTED_STATUSES.has(p.status)).length;
    return { confirmed, requested, total: filteredPins.length };
  }, [filteredPins]);

  // Default map center: Toronto-ish if no pins
  const defaultCenter: [number, number] = pins[0]
    ? [pins[0].lat, pins[0].lng]
    : [43.6532, -79.3832];

  return (
    <SitterShell>
      <Link to="/sitter" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to today
      </Link>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">Route map</h1>
          <p className="text-sm text-muted-foreground">
            See where your bookings are. Use it to spot clusters, decide which requests to accept, and plan a sensible loop.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 border border-border p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              <Filter className="mr-1 inline h-3 w-3" /> View
            </Label>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today (route order)</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="next_week">Next week</SelectItem>
                <SelectItem value="morning">Today · Morning (5am–12pm)</SelectItem>
                <SelectItem value="afternoon">Today · Afternoon (12pm–5pm)</SelectItem>
                <SelectItem value="evening">Today · Evening (5pm–10pm)</SelectItem>
                <SelectItem value="custom">Pick a date…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both — confirmed + requested</SelectItem>
                <SelectItem value="confirmed">Confirmed only</SelectItem>
                <SelectItem value="requested">Requested only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {timeframe === "custom" && (
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                <CalendarIcon className="mr-1 inline h-3 w-3" /> Date
              </Label>
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
            </div>
          )}
          <div className="flex items-end justify-start lg:justify-end">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CONFIRMED }} />
                {counts.confirmed} confirmed
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_REQUESTED }} />
                {counts.requested} requested
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Map */}
      {loading ? (
        <Card className="flex h-[60vh] items-center justify-center border border-border shadow-soft">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </Card>
      ) : pins.length === 0 ? (
        <Card className="border border-border p-6 shadow-soft">
          <EmptyState
            icon={<MapPin className="h-7 w-7" />}
            title="No mapped clients yet"
            description="As soon as a client saves their address (Account → Profile → Pickup address), they'll show up here. You can also add it for them on a client's profile page."
          />
          {missingAddress.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {missingAddress.length} active booking{missingAddress.length === 1 ? "" : "s"} without a mapped address.
            </p>
          )}
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border border-border shadow-soft">
            <div className="h-[60vh] min-h-[420px] w-full">
              <MapContainer
                center={defaultCenter}
                zoom={12}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds pins={orderedPins} />
                {orderedPins.map((p, idx) => (
                  <Marker
                    key={p.id}
                    position={[p.lat, p.lng]}
                    icon={isOrderableView ? numberedIcon(statusColor(p), idx + 1) : baseIcon(statusColor(p))}
                  >
                    <Popup>
                      <div className="min-w-[180px] space-y-1 text-sm">
                        <div className="font-display text-base text-primary">
                          {p.serviceName ?? "Booking"}{p.petName ? ` · ${p.petName}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.customerName ?? "Client"}
                        </div>
                        <div className="text-xs">
                          {p.scheduledStart
                            ? format(parseISO(p.scheduledStart), "EEE MMM d · h:mm a")
                            : p.requestedDate
                            ? `${format(parseISO(`${p.requestedDate}T12:00:00`), "EEE MMM d")}${p.requestedWindowLabel ? ` · ${p.requestedWindowLabel}` : ""}`
                            : "Time TBD"}
                        </div>
                        {p.addressLine && (
                          <div className="text-xs text-muted-foreground">{p.addressLine}</div>
                        )}
                        <div>
                          <Badge
                            variant="outline"
                            className="mt-1 capitalize"
                            style={{ borderColor: statusColor(p), color: statusColor(p) }}
                          >
                            {p.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="pt-1">
                          <Link
                            to={REQUESTED_STATUSES.has(p.status) ? `/sitter/requests/${p.id}` : `/sitter/bookings/${p.id}`}
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Open booking →
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </Card>

          {/* Route list (only in day-style views) */}
          {isOrderableView && orderedPins.length > 0 && (
            <Card className="mt-4 border border-border p-4 shadow-soft">
              <h3 className="mb-3 font-display text-lg text-primary">Suggested order</h3>
              <ol className="space-y-2 text-sm">
                {orderedPins.map((p, idx) => (
                  <li key={p.id} className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: statusColor(p) }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {p.serviceName}{p.petName ? ` · ${p.petName}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.scheduledStart
                          ? format(parseISO(p.scheduledStart), "h:mm a")
                          : p.requestedWindowLabel ?? "Time TBD"}
                        {" · "}
                        {p.customerName ?? "Client"} · {p.addressLine || "address on file"}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {p.isConfirmed ? "confirmed" : "requested"}
                    </Badge>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {missingAddress.length > 0 && (
            <Card className="mt-4 border border-amber-200 bg-amber-50/50 p-4 shadow-soft dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                <div className="text-sm">
                  <div className="font-medium">{missingAddress.length} booking{missingAddress.length === 1 ? "" : "s"} not on the map</div>
                  <p className="text-xs text-muted-foreground">
                    These clients haven't saved an address. Open their client profile and add one for them, or ask them to fill it in.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </SitterShell>
  );
}
