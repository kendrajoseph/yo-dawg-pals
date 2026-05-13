import { useEffect, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type Branding = {
  business_name: string | null;
  logo_url: string | null;
  footer_address: string | null;
  footer_phone: string | null;
  footer_website: string | null;
};

const EMPTY: Branding = {
  business_name: "",
  logo_url: "",
  footer_address: "",
  footer_phone: "",
  footer_website: "",
};

export default function SettingsBranding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Branding>(EMPTY);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("sitter_branding")
        .select("business_name, logo_url, footer_address, footer_phone, footer_website")
        .eq("sitter_id", user.id)
        .maybeSingle();
      if (data) setForm({ ...EMPTY, ...data });
      setLoading(false);
    })();
  }, [user?.id]);

  const update = (key: keyof Branding, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onUploadLogo = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `branding/${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      update("logo_url", data.publicUrl);
      toast({ title: "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await (supabase as any).from("sitter_branding").upsert({
      sitter_id: user.id,
      business_name: form.business_name || null,
      logo_url: form.logo_url || null,
      footer_address: form.footer_address || null,
      footer_phone: form.footer_phone || null,
      footer_website: form.footer_website || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Branding saved" });
    }
  };

  if (loading) {
    return (
      <SettingsLayout title="Branding" description="Logo and business details on invoices and emails.">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Branding" description="Logo and business details on invoices and emails.">
      <div className="space-y-4">
        <Card className="p-5 shadow-soft">
          <div className="space-y-1">
            <Label>Logo</Label>
            <p className="text-xs text-muted-foreground">PNG or JPG, square works best. Shown on the public pay page and invoice emails.</p>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadLogo(f);
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    {form.logo_url ? "Replace" : "Upload"}
                  </span>
                </Button>
              </label>
              {form.logo_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update("logo_url", "")}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5 shadow-soft">
          <div>
            <Label htmlFor="biz">Business name</Label>
            <Input id="biz" value={form.business_name ?? ""} onChange={(e) => update("business_name", e.target.value)} placeholder="e.g. Yodawg Pet Care" className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.footer_phone ?? ""} onChange={(e) => update("footer_phone", e.target.value)} placeholder="e.g. (555) 123-4567" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="web">Website</Label>
              <Input id="web" value={form.footer_website ?? ""} onChange={(e) => update("footer_website", e.target.value)} placeholder="https://yodawg.ca" className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="addr">Address</Label>
            <Textarea id="addr" value={form.footer_address ?? ""} onChange={(e) => update("footer_address", e.target.value)} placeholder="Street, City, Province, Postal" rows={2} className="mt-1" />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save branding
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
