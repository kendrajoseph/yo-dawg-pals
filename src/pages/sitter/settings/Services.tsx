import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ServiceRow } from "@/components/sitter/settings/ServiceEditDialog";
import { VariantEditDialog, type VariantRow } from "@/components/sitter/settings/VariantEditDialog";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(min: number) {
  if (min >= 1440 && min % 1440 === 0) {
    const days = min / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return `${h} hr${h === 1 ? "" : "s"}`;
  }
  return `${min} min`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `service-${Date.now()}`;
}

type EditDraft = { name: string; description: string; is_active: boolean };

export default function SettingsServices() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ name: "", description: "", is_active: true });
  const [savingService, setSavingService] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingVariant, setEditingVariant] = useState<VariantRow | null>(null);
  const [variantDialogContext, setVariantDialogContext] = useState<{ serviceId: string; serviceSlug: string; defaultSortOrder: number } | null>(null);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);

  const [deleteVariant, setDeleteVariant] = useState<VariantRow | null>(null);
  const [deleteService, setDeleteService] = useState<ServiceRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [svcRes, varRes] = await Promise.all([
      supabase.from("services").select("id, name, slug, description, is_active").order("sort_order").order("name"),
      supabase
        .from("service_variants")
        .select("id, service_id, slug, name, duration_minutes, price_cents, payment_mode, unit_label, sort_order, is_active")
        .order("sort_order")
        .order("price_cents"),
    ]);
    if (svcRes.error) toast({ title: "Couldn't load services", description: svcRes.error.message, variant: "destructive" });
    if (varRes.error) toast({ title: "Couldn't load pricing options", description: varRes.error.message, variant: "destructive" });
    setServices((svcRes.data ?? []) as ServiceRow[]);
    setVariants((varRes.data ?? []) as VariantRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (s: ServiceRow) => {
    setEditingId(s.id);
    setDraft({ name: s.name, description: s.description ?? "", is_active: s.is_active });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (s: ServiceRow) => {
    if (!draft.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSavingService(true);
    const { error } = await supabase
      .from("services")
      .update({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        is_active: draft.is_active,
      })
      .eq("id", s.id);
    setSavingService(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Service updated" });
    setEditingId(null);
    load();
  };

  const addService = async () => {
    setCreating(true);
    const baseName = "New service";
    let slug = slugify(baseName);
    // ensure unique
    const existing = new Set(services.map((s) => s.slug));
    if (existing.has(slug)) {
      let i = 2;
      while (existing.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    const nextSort = services.length;
    const { data, error } = await supabase
      .from("services")
      .insert({
        name: baseName,
        slug,
        description: null,
        is_active: false,
        price_cents: 0,
        duration_minutes: 30,
        sort_order: nextSort,
      })
      .select("id, name, slug, description, is_active")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Couldn't create service", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Service created", description: "Edit details, then add a pricing option." });
    setServices((prev) => [...prev, data as ServiceRow]);
    startEdit(data as ServiceRow);
  };

  const onAddVariant = (s: ServiceRow) => {
    const existing = variants.filter((v) => v.service_id === s.id);
    const nextOrder = existing.length ? Math.max(...existing.map((v) => v.sort_order)) + 1 : 0;
    setEditingVariant(null);
    setVariantDialogContext({ serviceId: s.id, serviceSlug: s.slug, defaultSortOrder: nextOrder });
    setVariantDialogOpen(true);
  };

  const onEditVariant = (s: ServiceRow, v: VariantRow) => {
    setEditingVariant(v);
    setVariantDialogContext({ serviceId: s.id, serviceSlug: s.slug, defaultSortOrder: v.sort_order });
    setVariantDialogOpen(true);
  };

  const confirmDeleteVariant = async () => {
    if (!deleteVariant) return;
    const { error } = await supabase.from("service_variants").delete().eq("id", deleteVariant.id);
    if (error) {
      toast({ title: "Couldn't remove option", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pricing option removed" });
    setDeleteVariant(null);
    load();
  };

  const confirmDeleteService = async () => {
    if (!deleteService) return;
    const { error } = await supabase.from("services").delete().eq("id", deleteService.id);
    if (error) {
      toast({ title: "Couldn't remove service", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Service removed" });
    setDeleteService(null);
    load();
  };

  return (
    <SettingsLayout title="Services & pricing" description="Edit your services and the pricing options customers see.">
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={addService} disabled={creating}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> {creating ? "Adding…" : "Add service"}
        </Button>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          {services.map((s) => {
            const svcVariants = variants.filter((v) => v.service_id === s.id);
            const isEditing = editingId === s.id;
            return (
              <Card key={s.id} className="border border-border p-5 shadow-soft">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={draft.name}
                        maxLength={80}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        rows={3}
                        maxLength={1000}
                        value={draft.description}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="text-sm font-medium">Active</div>
                        <div className="text-xs text-muted-foreground">Inactive services are hidden from the booking page.</div>
                      </div>
                      <Switch
                        checked={draft.is_active}
                        onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingService}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(s)} disabled={savingService}>
                        <Check className="mr-1 h-3.5 w-3.5" /> {savingService ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl text-primary">{s.name}</h3>
                        {!s.is_active && <Badge variant="secondary">Hidden</Badge>}
                      </div>
                      {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteService(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing options</div>
                    <Button size="sm" variant="ghost" onClick={() => onAddVariant(s)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                    </Button>
                  </div>

                  {svcVariants.length === 0 ? (
                    <div className="py-3 text-center text-xs text-muted-foreground">No pricing options yet. Add one to make this service bookable.</div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {svcVariants.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                              {v.name}
                              {!v.is_active && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                              {v.payment_mode === "free" && <Badge variant="secondary" className="text-[10px]">Free</Badge>}
                              {v.payment_mode === "deposit" && <Badge variant="secondary" className="text-[10px]">Deposit</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(v.duration_minutes)} · {formatPrice(v.price_cents)}
                              {v.unit_label ? ` · ${v.unit_label}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => onEditVariant(s, v)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteVariant(v)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {variantDialogContext && (
        <VariantEditDialog
          variant={editingVariant}
          serviceId={variantDialogContext.serviceId}
          serviceSlug={variantDialogContext.serviceSlug}
          defaultSortOrder={variantDialogContext.defaultSortOrder}
          open={variantDialogOpen}
          onOpenChange={setVariantDialogOpen}
          onSaved={load}
        />
      )}

      <AlertDialog open={!!deleteVariant} onOpenChange={(v) => !v && setDeleteVariant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this pricing option?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteVariant?.name}" will no longer be selectable on the booking page. Past bookings already using it will keep their pricing on record but will no longer link to this option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVariant}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteService} onOpenChange={(v) => !v && setDeleteService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this service?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteService?.name}" and all of its pricing options will be removed. Services with existing bookings can't be deleted — hide them instead by toggling Active off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteService}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
