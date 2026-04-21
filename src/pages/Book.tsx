import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Check, PawPrint, Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS, formatPriceWithDecimals, minutesToTime } from "@/lib/booking";

type Service = {
  id: string; slug: string; name: string; description: string | null;
  price_cents: number; duration_minutes: number; unit_label: string | null;
};
type Pet = { id: string; name: string; breed: string | null; photo_url: string | null };
type Avail = { sitter_id: string; weekday: number; start_minute: number; end_minute: number };
type Blocked = { sitter_id: string; blocked_date: string };
type Booking = { sitter_id: string; start_at: string; end_at: string };

const STEPS = ["Service", "Date & time", "Pet", "Review"] as const;

const Book = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetSlug = params.get("service");

  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [availability, setAvailability] = useState<Avail[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [existing, setExisting] = useState<Booking[]>([]);
  const [sitterId, setSitterId] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<number | null>(null); // start minute of day
  const [petId, setPetId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load services + availability + bookings (public reads)
  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: a }, { data: bd }] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("availability").select("sitter_id, weekday, start_minute, end_minute"),
        supabase.from("blocked_dates").select("sitter_id, blocked_date"),
      ]);
      setServices((s ?? []) as Service[]);
      setAvailability((a ?? []) as Avail[]);
      setBlocked((bd ?? []) as Blocked[]);
      // pick the first sitter with availability, fallback to any sitter (will be null if none)
      const sid = (a ?? [])[0]?.sitter_id ?? null;
      setSitterId(sid);
      if (sid) {
        const { data: bk } = await supabase
          .from("bookings")
          .select("sitter_id, start_at, end_at")
          .eq("sitter_id", sid)
          .in("status", ["pending_payment", "confirmed"]);
        setExisting((bk ?? []) as Booking[]);
      }
      if (presetSlug && s) {
        const found = s.find((x) => x.slug === presetSlug);
        if (found) setServiceId(found.id);
      }
    })();
  }, [presetSlug]);

  // Load user pets
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("pets").select("id, name, breed, photo_url")
        .eq("owner_id", user.id).order("created_at");
      setPets((data ?? []) as Pet[]);
    })();
  }, [user]);

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [serviceId, services]);

  // Compute available slots for the selected date for the chosen sitter
  const slots = useMemo<number[]>(() => {
    if (!date || !service || !sitterId) return [];
    const wd = date.getDay();
    const dayBlocks = availability.filter((a) => a.sitter_id === sitterId && a.weekday === wd);
    if (dayBlocks.length === 0) return [];
    const isBlocked = blocked.some(
      (b) => b.sitter_id === sitterId && isSameDay(new Date(b.blocked_date + "T12:00:00"), date),
    );
    if (isBlocked) return [];

    const dur = service.duration_minutes;
    const STEP_MIN = 30;
    const out: number[] = [];

    for (const block of dayBlocks) {
      for (let m = block.start_minute; m + dur <= block.end_minute; m += STEP_MIN) {
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const slotStart = new Date(start.getTime() + m * 60_000);
        const slotEnd = new Date(slotStart.getTime() + dur * 60_000);
        // skip past
        if (slotStart.getTime() < Date.now() + 60 * 60_000) continue;
        // conflict with existing
        const conflict = existing.some((b) => {
          const bs = new Date(b.start_at).getTime();
          const be = new Date(b.end_at).getTime();
          return slotStart.getTime() < be && slotEnd.getTime() > bs;
        });
        if (!conflict) out.push(m);
      }
    }
    return out;
  }, [date, service, sitterId, availability, blocked, existing]);

  const next = () => {
    if (step === 0 && !serviceId) return toast({ title: "Pick a service", variant: "destructive" });
    if (step === 1 && (!date || slot === null)) return toast({ title: "Pick a date and time", variant: "destructive" });
    if (step === 2 && !petId) return toast({ title: "Pick a pet", variant: "destructive" });
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!user || !service || !date || slot === null || !petId || !sitterId) return;
    setSubmitting(true);
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const start_at = new Date(start.getTime() + slot * 60_000).toISOString();
    const end_at = new Date(start.getTime() + (slot + service.duration_minutes) * 60_000).toISOString();
    const deposit_cents = Math.round(service.price_cents * 0.25);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        start_at, end_at,
        total_cents: service.price_cents,
        deposit_cents,
        notes: notes || null,
        status: "pending_payment",
      })
      .select("id").single();

    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't book", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/booking/${data.id}/success`);
  };

  // Auth gating: allow browsing service step but require login by step 2
  useEffect(() => {
    if (!authLoading && !user && step >= 2) {
      navigate("/auth", { state: { from: "/book" } });
    }
  }, [step, user, authLoading, navigate]);

  const getDayDisabled = (d: Date) => {
    const today = startOfDay(new Date());
    if (d < today) return true;
    if (d > addDays(today, 60)) return true;
    if (!sitterId) return true;
    const wd = d.getDay();
    const has = availability.some((a) => a.sitter_id === sitterId && a.weekday === wd);
    if (!has) return true;
    const isBlocked = blocked.some(
      (b) => b.sitter_id === sitterId && isSameDay(new Date(b.blocked_date + "T12:00:00"), d),
    );
    return isBlocked;
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <span className="font-tag text-2xl text-tag -rotate-2 inline-block">lock it in</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Book a <span className="text-gradient-spray">service.</span>
        </h1>

        {/* Stepper */}
        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className={cn(
              "border-2 border-primary px-2 py-2 text-center font-display text-xs uppercase tracking-tight transition-all",
              i < step ? "bg-secondary text-secondary-foreground shadow-pop" :
              i === step ? "bg-accent text-accent-foreground shadow-pop-tag -rotate-1" :
              "bg-card text-muted-foreground"
            )}>
              <span className="hidden sm:inline">{i + 1}. </span>{label}
            </li>
          ))}
        </ol>

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop-lg sm:p-6">
          {/* Step 0: service */}
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Pick a service</h2>
              <RadioGroup value={serviceId ?? ""} onValueChange={setServiceId} className="mt-4 grid gap-3">
                {services.map((s) => (
                  <label key={s.id} className={cn(
                    "flex cursor-pointer items-start gap-3 border-2 border-primary p-4 transition-colors",
                    serviceId === s.id ? "bg-highlight" : "bg-card hover:bg-muted",
                  )}>
                    <RadioGroupItem value={s.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-display text-xl uppercase">{s.name}</span>
                        <span className="font-display text-2xl text-clay">
                          {formatPriceWithDecimals(s.price_cents)}<span className="text-xs opacity-70">{s.unit_label}</span>
                        </span>
                      </div>
                      <p className="text-sm text-foreground/75">{s.description}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {s.duration_minutes} min
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 1: date & time */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Pick a date & time</h2>
              {!sitterId && (
                <p className="mt-3 text-sm text-clay">No sitter availability set yet — check back soon.</p>
              )}
              <div className="mt-4 grid gap-6 md:grid-cols-[auto,1fr]">
                <div className="border-2 border-primary bg-card">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setSlot(null); }}
                    disabled={getDayDisabled}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
                <div>
                  <p className="font-display text-sm uppercase text-muted-foreground">
                    {date ? format(date, "EEEE, MMM d") : "Select a date"}
                  </p>
                  {date && slots.length === 0 && (
                    <p className="mt-2 text-sm text-clay">No times open this day.</p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((m) => (
                      <button
                        key={m}
                        onClick={() => setSlot(m)}
                        className={cn(
                          "border-2 border-primary px-2 py-2 font-display text-xs uppercase transition-all",
                          slot === m ? "bg-tag text-tag-foreground shadow-pop-accent -translate-y-0.5" : "bg-card hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5",
                        )}
                      >
                        {minutesToTime(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: pet */}
          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Who's coming?</h2>
              {pets.length === 0 ? (
                <Card className="mt-4 -rotate-1 border-2 border-primary bg-highlight p-6 text-center shadow-pop">
                  <PawPrint className="mx-auto h-8 w-8 text-clay" />
                  <p className="mt-2 font-tag text-xl text-clay">no pets on file yet</p>
                  <Button asChild className="mt-3 font-display uppercase">
                    <Link to="/account/pets">Add a pet</Link>
                  </Button>
                </Card>
              ) : (
                <RadioGroup value={petId ?? ""} onValueChange={setPetId} className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pets.map((p) => (
                    <label key={p.id} className={cn(
                      "flex cursor-pointer items-center gap-3 border-2 border-primary p-3",
                      petId === p.id ? "bg-highlight" : "bg-card hover:bg-muted",
                    )}>
                      <RadioGroupItem value={p.id} />
                      <div className="h-12 w-12 overflow-hidden border-2 border-primary bg-muted">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <PawPrint className="h-5 w-5 opacity-40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-lg uppercase leading-tight">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.breed}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
              <div className="mt-5">
                <Label>Notes for your sitter (optional)</Label>
                <Textarea rows={3} maxLength={500} value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know — leashes, food times, treats." />
              </div>
            </div>
          )}

          {/* Step 3: review */}
          {step === 3 && service && date && slot !== null && petId && (
            <div>
              <h2 className="font-display text-2xl uppercase">Review</h2>
              <dl className="mt-4 divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
                <Row label="Service" value={service.name} />
                <Row label="When" value={`${format(date, "EEE, MMM d")} · ${minutesToTime(slot)}`} />
                <Row label="Duration" value={`${service.duration_minutes} min`} />
                <Row label="Pet" value={pets.find((p) => p.id === petId)?.name ?? ""} />
                <Row label="Total" value={formatPriceWithDecimals(service.price_cents)} />
                <Row label="Deposit (25%)" value={formatPriceWithDecimals(Math.round(service.price_cents * 0.25))} accent />
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                A 25% deposit will be requested next. Balance is due after the service.
              </p>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="bg-accent text-accent-foreground font-display uppercase shadow-pop-tag hover:-translate-y-0.5 transition-transform">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="bg-tag text-tag-foreground font-display uppercase shadow-pop-accent hover:-translate-y-0.5 transition-transform">
                {submitting ? "Booking…" : (<>Confirm booking <Check className="h-4 w-4" /></>)}
              </Button>
            )}
          </div>
        </Card>

        {/* Tips */}
        <p className="mt-6 inline-flex items-center gap-2 font-tag text-tag text-lg -rotate-1">
          <CalendarDays className="h-4 w-4" /> showing the next 60 days · weekly availability set by your sitter
        </p>
      </section>
      <SiteFooter />
    </main>
  );
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={cn("flex items-center justify-between p-3", accent && "bg-highlight")}>
    <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn("font-display text-base uppercase", accent && "text-clay text-lg")}>{value}</dd>
  </div>
);

export default Book;
