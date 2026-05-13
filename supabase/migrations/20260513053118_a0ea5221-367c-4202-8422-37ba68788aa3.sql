-- Branding (one row per sitter, public-readable for pay page)
CREATE TABLE public.sitter_branding (
  sitter_id uuid PRIMARY KEY,
  business_name text,
  logo_url text,
  footer_address text,
  footer_phone text,
  footer_website text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sitter_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branding is public readable" ON public.sitter_branding FOR SELECT USING (true);
CREATE POLICY "Sitters insert own branding" ON public.sitter_branding FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));
CREATE POLICY "Sitters update own branding" ON public.sitter_branding FOR UPDATE TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));
CREATE TRIGGER trg_sitter_branding_updated BEFORE UPDATE ON public.sitter_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message templates
CREATE TABLE public.sitter_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id uuid NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  subject text,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sitter_id, kind, channel)
);
ALTER TABLE public.sitter_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sitters manage own templates" ON public.sitter_message_templates FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));
CREATE TRIGGER trg_sitter_templates_updated BEFORE UPDATE ON public.sitter_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reminder cadence (one row per sitter)
CREATE TABLE public.sitter_reminder_settings (
  sitter_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sitter_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sitters manage own reminder settings" ON public.sitter_reminder_settings FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND has_role(auth.uid(), 'sitter'::app_role));
CREATE TRIGGER trg_sitter_reminders_updated BEFORE UPDATE ON public.sitter_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-invoice override
CREATE TABLE public.invoice_reminder_overrides (
  invoice_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  rules jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_reminder_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sitters manage overrides for own invoices" ON public.invoice_reminder_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_reminder_overrides.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_reminder_overrides.invoice_id AND i.sitter_id = auth.uid() AND has_role(auth.uid(), 'sitter'::app_role)));
CREATE POLICY "Customers view overrides on own invoices" ON public.invoice_reminder_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_reminder_overrides.invoice_id AND i.customer_id = auth.uid()));
CREATE TRIGGER trg_invoice_override_updated BEFORE UPDATE ON public.invoice_reminder_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();