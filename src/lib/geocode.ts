/**
 * Lightweight geocoding via OpenStreetMap Nominatim.
 *
 * Nominatim is free and requires no API key, but their usage policy asks for:
 *  - max ~1 request/sec from a single source
 *  - a descriptive User-Agent (we use the Referer header which the browser sends)
 *
 * For this app we only geocode when a client saves their address (rare event),
 * so rate limits won't be an issue.
 */

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export type AddressInput = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export function buildAddressQuery(addr: AddressInput): string {
  return [
    addr.line1,
    addr.line2,
    addr.city,
    addr.province,
    addr.postalCode,
    addr.country || "Canada",
  ]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function geocodeAddress(addr: AddressInput): Promise<GeocodeResult | null> {
  const q = buildAddressQuery(addr);
  if (!q || q.length < 6) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data?.length) return null;
    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      displayName: first.display_name,
    };
  } catch (err) {
    console.error("[geocode] failed", err);
    return null;
  }
}
