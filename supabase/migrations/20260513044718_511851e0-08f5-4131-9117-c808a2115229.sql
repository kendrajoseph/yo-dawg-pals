ALTER TABLE public.sitter_settings
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS invoice_footer text;