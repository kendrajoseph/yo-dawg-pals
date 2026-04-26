import { useEffect, useState } from "react";
import { MapPin, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/lib/geocode";

type Props = {
  userId: string;
  /** Optional: render compact (used in admin/sitter contexts) */
  compact?: boolean;
};

type AddressState = {
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  address_lat: number | null;
  address_lng: number | null;
};

const empty: AddressState = {
  address_line1: "",
  address_line2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Canada",
  address_lat: null,
  address_lng: null,
};

export function AddressEditor({ userId, compact }: Props) {
  const [form, setForm] = useState<AddressState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("address_line1, address_line2, city, province, postal_code, country, address_lat, address_lng")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setForm({
          address_line1: data.address_line1 ?? "",
          address_line2: data.address_line2 ?? "",
          city: data.city ?? "",
          province: data.province ?? "",
          postal_code: data.postal_code ?? "",
          country: data.country ?? "Canada",
          address_lat: data.address_lat,
          address_lng: data.address_lng,
        });
        if (data.address_lat && data.address_lng) {
          setGeocoded({ lat: data.address_lat, lng: data.address_lng });
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const handleChange = (k: keyof AddressState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k !== "country") setGeocoded(null);
  };

  const handleSave = async () => {
    if (!form.address_line1.trim() || !form.city.trim()) {
      toast({
        title: "Address incomplete",
        description: "We need at least street address and city to map you.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    // Try to geocode (best-effort — we still save the address even if it fails)
    const result = await geocodeAddress({
      line1: form.address_line1,
      line2: form.address_line2,
      city: form.city,
      province: form.province,
      postalCode: form.postal_code,
      country: form.country,
    });

    const update = {
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim(),
      province: form.province.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim() || "Canada",
      address_lat: result?.lat ?? null,
      address_lng: result?.lng ?? null,
      address_geocoded_at: result ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    setSaving(false);

    if (error) {
      toast({ title: "Couldn't save address", description: error.message, variant: "destructive" });
      return;
    }

    if (result) {
      setGeocoded({ lat: result.lat, lng: result.lng });
      toast({
        title: "Address saved & mapped",
        description: "Your sitter can now see your pickup location on her route map.",
      });
    } else {
      setGeocoded(null);
      toast({
        title: "Address saved (couldn't auto-locate)",
        description: "We'll keep the address but couldn't pin it on the map. Double-check spelling — it's usually a typo.",
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading address…</div>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="addr-line1" className="text-xs uppercase tracking-wide text-muted-foreground">
            Street address
          </Label>
          <Input
            id="addr-line1"
            value={form.address_line1}
            onChange={(e) => handleChange("address_line1", e.target.value)}
            placeholder="123 Main St"
            autoComplete="address-line1"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr-line2" className="text-xs uppercase tracking-wide text-muted-foreground">
            Apartment / unit (optional)
          </Label>
          <Input
            id="addr-line2"
            value={form.address_line2}
            onChange={(e) => handleChange("address_line2", e.target.value)}
            autoComplete="address-line2"
          />
        </div>
        <div>
          <Label htmlFor="addr-city" className="text-xs uppercase tracking-wide text-muted-foreground">City</Label>
          <Input
            id="addr-city"
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <Label htmlFor="addr-prov" className="text-xs uppercase tracking-wide text-muted-foreground">Province</Label>
          <Input
            id="addr-prov"
            value={form.province}
            onChange={(e) => handleChange("province", e.target.value)}
            placeholder="ON"
            autoComplete="address-level1"
          />
        </div>
        <div>
          <Label htmlFor="addr-postal" className="text-xs uppercase tracking-wide text-muted-foreground">Postal code</Label>
          <Input
            id="addr-postal"
            value={form.postal_code}
            onChange={(e) => handleChange("postal_code", e.target.value)}
            placeholder="M5V 2H1"
            autoComplete="postal-code"
          />
        </div>
        <div>
          <Label htmlFor="addr-country" className="text-xs uppercase tracking-wide text-muted-foreground">Country</Label>
          <Input
            id="addr-country"
            value={form.country}
            onChange={(e) => handleChange("country", e.target.value)}
            autoComplete="country-name"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {geocoded ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Mapped at {geocoded.lat.toFixed(4)}, {geocoded.lng.toFixed(4)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Not yet on the map
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Save address"}
        </Button>
      </div>
    </div>
  );
}
