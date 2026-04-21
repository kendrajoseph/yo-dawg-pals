
-- Lock function search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Replace broad SELECT-on-objects policies with folder-scoped ones.
-- Public images stay accessible via the public URL because the buckets are public,
-- but anonymous LIST queries on storage.objects are now blocked.
DROP POLICY IF EXISTS "Pet photos are public" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are public" ON storage.objects;

CREATE POLICY "Users list own pet files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users list own avatar files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed services
INSERT INTO public.services (slug, name, description, price_cents, duration_minutes, unit_label, sort_order)
VALUES
  ('walk',     'Dog Walking', 'Solo or buddy walks around your neighbourhood — rain, snow or sunshine.', 2000, 30, '/ 30 min', 1),
  ('sitting',  'Pet Sitting', 'Drop-in visits for feeding, playtime, cuddles and a potty break.',       2500, 45, '/ visit',  2),
  ('boarding', 'Boarding',    'Overnight stays in a cozy, dog-friendly home while you''re away.',        5500, 720,'/ night',  3),
  ('training', 'Training',    'Sit, stay, leash manners and house rules — positive reinforcement only.', 4000, 60, '/ session',4)
ON CONFLICT (slug) DO NOTHING;
