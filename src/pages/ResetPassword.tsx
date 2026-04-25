import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SiteNav from "@/components/SiteNav";
import { PawPrint } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters").max(72),
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase parses the recovery hash and emits a PASSWORD_RECOVERY event when the
  // user lands here from the email link. We wait for a session before allowing update.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const parsed = schema.safeParse({ password });
    if (!parsed.success) {
      toast({ title: "Check your password", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated", description: "You're signed in with your new password." });
    navigate("/account", { replace: true });
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10 sm:px-8 sm:py-16">
        <div className="relative -rotate-1 border-4 border-primary bg-card p-6 shadow-pop sm:p-8">
          <div className="absolute -top-5 -right-3 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground shadow-pop stamp">
            <PawPrint className="h-7 w-7" />
          </div>
          <h1 className="font-display text-4xl text-primary">
            Set a new <span className="text-gradient-sunlight">password</span>
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            {ready
              ? "Pick something memorable. At least 8 characters."
              : "Open this page from the link in your password reset email."}
          </p>

          {ready && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="rp-pw">New password</Label>
                <Input id="rp-pw" type="password" autoComplete="new-password" required minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rp-pw2">Confirm password</Label>
                <Input id="rp-pw2" type="password" autoComplete="new-password" required minLength={8}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 font-display uppercase shadow-pop-accent">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default ResetPassword;
