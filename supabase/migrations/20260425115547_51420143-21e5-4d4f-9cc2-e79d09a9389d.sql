
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_sitter_id_fkey FOREIGN KEY (sitter_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
