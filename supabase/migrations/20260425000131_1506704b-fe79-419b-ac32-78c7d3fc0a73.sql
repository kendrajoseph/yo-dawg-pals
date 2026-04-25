-- Reminder settings (one row per sitter)
CREATE TABLE public.reminder_settings (
  sitter_id UUID PRIMARY KEY,
  auto_enabled BOOLEAN NOT NULL DEFAULT false,
  cadence JSONB NOT NULL DEFAULT '{"before_due_days":[3],"on_due":true,"after_due_days":[3,7]}'::jsonb,
  default_tone TEXT NOT NULL DEFAULT 'friendly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage own reminder settings"
  ON public.reminder_settings FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca')
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca');

CREATE TRIGGER reminder_settings_updated_at
  BEFORE UPDATE ON public.reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice number sequence
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.invoice_number_seq');
  RETURN 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 4, '0');
END;
$$;

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  sitter_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE DEFAULT public.generate_invoice_number(),
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  notes TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft','sent','paid','partial','overdue','void','refunded'))
);

CREATE INDEX invoices_booking_idx ON public.invoices(booking_id);
CREATE INDEX invoices_sitter_status_idx ON public.invoices(sitter_id, status);
CREATE INDEX invoices_customer_idx ON public.invoices(customer_id);
CREATE INDEX invoices_public_token_idx ON public.invoices(public_token);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage own invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca')
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca');

CREATE POLICY "Customers view own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Admins view all invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice line items
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'custom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT line_item_kind_check CHECK (kind IN ('service','extra_time','late_fee','discount','custom','tip','tax'))
);

CREATE INDEX invoice_line_items_invoice_idx ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage own invoice line items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role) AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'));

CREATE POLICY "Customers view own invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.customer_id = auth.uid()));

CREATE POLICY "Admins view all invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Payment events (append-only timeline)
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  invoice_id UUID,
  kind TEXT NOT NULL,
  channel TEXT,
  amount_cents INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_event_kind_check CHECK (kind IN ('invoice_sent','reminder_sent','receipt_sent','charge_attempt','charge_succeeded','charge_failed','refund','manual_paid','voided','public_link_copied','invoice_created','invoice_updated'))
);

CREATE INDEX payment_events_booking_idx ON public.payment_events(booking_id, created_at DESC);
CREATE INDEX payment_events_invoice_idx ON public.payment_events(invoice_id, created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters view own payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (
    (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payment_events.booking_id AND b.sitter_id = auth.uid() AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'))
    OR (invoice_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_events.invoice_id AND i.sitter_id = auth.uid() AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'))
  );

CREATE POLICY "Sitters insert own payment events"
  ON public.payment_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND has_role(auth.uid(), 'sitter'::app_role)
    AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
    AND (
      (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payment_events.booking_id AND b.sitter_id = auth.uid()))
      OR (invoice_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_events.invoice_id AND i.sitter_id = auth.uid()))
    )
  );

CREATE POLICY "Customers view own payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (
    (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payment_events.booking_id AND b.customer_id = auth.uid()))
    OR (invoice_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payment_events.invoice_id AND i.customer_id = auth.uid()))
  );

CREATE POLICY "Admins view all payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts payment events"
  ON public.payment_events FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- Public invoice lookup helper (returns invoice + line items for a token, no auth needed)
CREATE OR REPLACE FUNCTION public.get_public_invoice(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'invoice', to_jsonb(i.*),
    'line_items', COALESCE(jsonb_agg(li.* ORDER BY li.sort_order, li.created_at) FILTER (WHERE li.id IS NOT NULL), '[]'::jsonb),
    'sitter_name', (SELECT p.full_name FROM public.profiles p WHERE p.id = i.sitter_id),
    'customer_name', (SELECT p.full_name FROM public.profiles p WHERE p.id = i.customer_id)
  ) INTO result
  FROM public.invoices i
  LEFT JOIN public.invoice_line_items li ON li.invoice_id = i.id
  WHERE i.public_token = _token AND i.status <> 'void'
  GROUP BY i.id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_invoice(TEXT) TO anon, authenticated;