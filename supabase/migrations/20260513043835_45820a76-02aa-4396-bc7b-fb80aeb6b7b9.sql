ALTER TABLE public.bookings ALTER COLUMN pet_id DROP NOT NULL;
ALTER TABLE public.bookings DROP CONSTRAINT bookings_pet_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pet_id_fkey
  FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE SET NULL;