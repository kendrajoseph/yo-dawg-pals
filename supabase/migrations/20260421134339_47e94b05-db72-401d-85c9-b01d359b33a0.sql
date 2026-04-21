
-- =========== Roles ===========
CREATE TYPE public.app_role AS ENUM ('customer', 'sitter', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========== Profiles ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== Pets ===========
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  breed TEXT,
  age_years INT,
  weight_lbs INT,
  photo_url TEXT,
  notes TEXT,
  vet_info TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pets_updated BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "Owners view their pets" ON public.pets
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their pets" ON public.pets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their pets" ON public.pets
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete their pets" ON public.pets
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- =========== Services ===========
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  duration_minutes INT NOT NULL,
  unit_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are public" ON public.services FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage services" ON public.services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== Availability ===========
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INT NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute INT NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability is public" ON public.availability FOR SELECT USING (true);
CREATE POLICY "Sitters manage own availability" ON public.availability
  FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
  WITH CHECK (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'));

-- =========== Blocked dates ===========
CREATE TABLE public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sitter_id, blocked_date)
);
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blocked dates are public" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Sitters manage own blocked dates" ON public.blocked_dates
  FOR ALL TO authenticated
  USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
  WITH CHECK (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'));

-- =========== Bookings ===========
CREATE TYPE public.booking_status AS ENUM (
  'pending_payment','confirmed','cancelled','completed','refunded'
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sitter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  total_cents INT NOT NULL,
  deposit_cents INT NOT NULL,
  notes TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX bookings_sitter_time ON public.bookings (sitter_id, start_at);
CREATE INDEX bookings_customer_time ON public.bookings (customer_id, start_at DESC);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "Customers view own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Sitters view own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = sitter_id);
CREATE POLICY "Customers create own bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers update own bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Sitters update own bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = sitter_id)
  WITH CHECK (auth.uid() = sitter_id);

-- Sitters can see pets attached to their bookings
CREATE POLICY "Sitters view pets in their bookings" ON public.pets
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'sitter') AND EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.pet_id = pets.id AND b.sitter_id = auth.uid()
    )
  );

-- =========== Storage buckets ===========
INSERT INTO storage.buckets (id, name, public) VALUES ('pets', 'pets', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Pet photos are public" ON storage.objects FOR SELECT USING (bucket_id = 'pets');
CREATE POLICY "Users upload own pet photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own pet photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own pet photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars are public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
