ALTER TABLE public.client_messages ADD COLUMN IF NOT EXISTS email_html text;

ALTER TYPE public.client_message_kind ADD VALUE IF NOT EXISTS 'invoice';
ALTER TYPE public.client_message_kind ADD VALUE IF NOT EXISTS 'receipt';
ALTER TYPE public.client_message_kind ADD VALUE IF NOT EXISTS 'reminder';