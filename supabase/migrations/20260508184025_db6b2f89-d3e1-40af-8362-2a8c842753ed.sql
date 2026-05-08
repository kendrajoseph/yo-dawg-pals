-- 1. SITTER SETTINGS
CREATE TABLE IF NOT EXISTS public.sitter_settings (
  sitter_id UUID PRIMARY KEY,
  tax_enabled BOOLEAN NOT NULL DEFAULT false,
  tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 13.00,
  tax_label TEXT NOT NULL DEFAULT 'HST',
  tax_registration_number TEXT,
  auto_invoice_on_confirm BOOLEAN NOT NULL DEFAULT true,
  default_due_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sitter_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage own settings"
  ON public.sitter_settings FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

CREATE TRIGGER sitter_settings_updated_at
  BEFORE UPDATE ON public.sitter_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sitter_settings (sitter_id)
SELECT id FROM auth.users WHERE email = 'anneke@yodawg.ca'
ON CONFLICT DO NOTHING;

-- 2. PROMOTIONS
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  applicable_service_ids UUID[] DEFAULT '{}',
  code TEXT,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_discount_type_check CHECK (discount_type IN ('percent', 'fixed', 'free_nth'))
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage own promos"
  ON public.promotions FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

CREATE INDEX idx_promotions_sitter ON public.promotions(sitter_id, is_active);

CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. INVOICE SCHEMA ADDITIONS
ALTER TABLE public.invoices ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS request_group_id UUID REFERENCES public.booking_request_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tax_label TEXT,
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_request_group_idx ON public.invoices(request_group_id);

-- 4. RLS - Remove hardcoded email
DROP POLICY IF EXISTS "Sitters manage own invoices" ON public.invoices;
CREATE POLICY "Sitters manage own invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

DROP POLICY IF EXISTS "Sitters manage own invoice line items" ON public.invoice_line_items;
CREATE POLICY "Sitters manage own invoice line items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role)));

DROP POLICY IF EXISTS "Sitters manage own reminder settings" ON public.reminder_settings;
CREATE POLICY "Sitters manage own reminder settings"
  ON public.reminder_settings FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

DROP POLICY IF EXISTS "Sitters view own payment events" ON public.payment_events;
CREATE POLICY "Sitters view own payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (
    (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payment_events.booking_id AND b.sitter_id = auth.uid()))
    OR (invoice_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_events.invoice_id AND i.sitter_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Sitters insert own payment events" ON public.payment_events;
CREATE POLICY "Sitters insert own payment events"
  ON public.payment_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND has_role(auth.uid(), 'sitter'::app_role)
    AND (
      (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payment_events.booking_id AND b.sitter_id = auth.uid()))
      OR (invoice_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_events.invoice_id AND i.sitter_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Sitters view own booking request groups" ON public.booking_request_groups;
CREATE POLICY "Sitters view own booking request groups"
  ON public.booking_request_groups FOR SELECT TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

DROP POLICY IF EXISTS "Sitters update own booking request groups" ON public.booking_request_groups;
CREATE POLICY "Sitters update own booking request groups"
  ON public.booking_request_groups FOR UPDATE TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));

-- 6. SIBLING DISCOUNT FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_sibling_discount(
  _request_group_id UUID,
  _booking_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  _position INTEGER;
  _discount_pct INTEGER;
BEGIN
  SELECT bundle_position INTO _position FROM bookings WHERE id = _booking_id;

  IF _position IS NULL OR _position = 0 THEN
    RETURN 0;
  END IF;

  SELECT sv.sibling_discount_percent INTO _discount_pct
  FROM bookings b
  JOIN service_variants sv ON sv.id = b.service_variant_id
  WHERE b.id = _booking_id;

  RETURN COALESCE(_discount_pct, 0);
END;
$$;