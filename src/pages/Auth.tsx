import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import SiteNav from "@/components/SiteNav";
import { PawPrint } from "lucide-react";
import { track } from "@/integrations/posthog/PostHogProvider";

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});
const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Required").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = (location.state as { from?: string; reason?: string } | null) ?? {};
  const from = state.from || "/account";
  const isBookingFlow = state.reason === "booking" || from.startsWith("/book");

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const [tab, setTab] = useState<"signin" | "signup">(isBookingFlow ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check your details", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}${from}`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome to the pack!", description: "You're signed in." });
    track("user_signed_up", { source: from });
    navigate(from, { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check your details", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      return;
    }
    track("user_signed_in");
    navigate(from, { replace: true });
  };

  const handleForgotPassword = async () => {
    const email = form.email.trim();
    if (!email || !z.string().email().safeParse(email).success) {
      toast({ title: "Enter your email first", description: "Type the email above, then tap forgot password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send reset email", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Check your inbox", description: "We sent a reset link to " + email });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${from}`,
    });
    if (result.error) {
      setLoading(false);
      toast({ title: "Google sign-in failed", description: String(result.error.message ?? result.error), variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate(from, { replace: true });
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10 sm:px-8 sm:py-16">
        <Link to="/" className="font-tag text-clay text-xl -rotate-2 self-start">
          ← back to the pack
        </Link>

        <div className="relative -rotate-1 border-4 border-primary bg-card p-6 shadow-pop sm:p-8">
          <div className="absolute -top-5 -right-3 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground shadow-pop stamp">
            <PawPrint className="h-7 w-7" />
          </div>
          <h1 className="font-display text-4xl text-primary">
            {isBookingFlow ? (<>Almost there,<br /><span className="text-gradient-sunlight">good human.</span></>) : (<>Get in,<br /><span className="text-gradient-sunlight">good boy.</span></>)}
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            {isBookingFlow
              ? "Create a quick account so we can save your request — you'll land right back where you left off."
              : "Book sitters, manage pets, track visits."}
          </p>
          {isBookingFlow && (
            <div className="mt-4 rounded-md border-2 border-dashed border-primary/40 bg-accent/20 p-3 text-xs text-foreground/80">
              <strong className="font-display uppercase text-primary">Your request is saved.</strong>{" "}
              Sign up (or sign in) and you'll return to your booking with everything filled in.
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="font-display uppercase">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="font-display uppercase">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" autoComplete="email" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" type="password" autoComplete="current-password" required
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-display uppercase shadow-pop-accent">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" required maxLength={100}
                    value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" autoComplete="email" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" type="password" autoComplete="new-password" required minLength={8}
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <p className="mt-1 text-xs text-muted-foreground">8+ characters</p>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-display uppercase shadow-pop-accent">
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-display text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogle}
            className="mt-4 w-full h-11 font-display uppercase border-2 border-primary"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path d="M21.35 11.1H12v3.2h5.35c-.23 1.46-1.7 4.27-5.35 4.27a5.97 5.97 0 0 1 0-11.94c1.7 0 2.84.72 3.5 1.34l2.4-2.3C16.4 4.2 14.4 3.3 12 3.3a8.7 8.7 0 1 0 0 17.4c5.02 0 8.34-3.52 8.34-8.48 0-.57-.06-1-.13-1.12Z" fill="currentColor" />
            </svg>
            Continue with Google
          </Button>
        </div>
      </section>
    </main>
  );
};

export default Auth;
