import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!token) {
        setState({ kind: "invalid", message: "Missing unsubscribe token." });
        return;
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.valid) setState({ kind: "valid" });
        else if (data?.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid", message: data?.error ?? "Invalid or expired link." });
      } catch (e: any) {
        if (!cancelled) setState({ kind: "invalid", message: e?.message ?? "Could not validate link." });
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm() {
    if (!token) return;
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState({ kind: "error", message: error.message ?? "Could not unsubscribe." });
      return;
    }
    if ((data as any)?.success) setState({ kind: "success" });
    else if ((data as any)?.reason === "already_unsubscribed") setState({ kind: "already" });
    else setState({ kind: "error", message: "Unexpected response." });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.kind === "loading" && <p className="text-muted-foreground">Checking your link…</p>}
            {state.kind === "valid" && (
              <>
                <p>Click below to unsubscribe from these emails.</p>
                <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
              </>
            )}
            {state.kind === "submitting" && <p className="text-muted-foreground">Unsubscribing…</p>}
            {state.kind === "success" && (
              <p>You've been unsubscribed. You won't receive these emails anymore.</p>
            )}
            {state.kind === "already" && <p>This address is already unsubscribed.</p>}
            {state.kind === "invalid" && (
              <p className="text-destructive">{state.message}</p>
            )}
            {state.kind === "error" && (
              <>
                <p className="text-destructive">{state.message}</p>
                <Button onClick={confirm} variant="outline" className="w-full">Try again</Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
