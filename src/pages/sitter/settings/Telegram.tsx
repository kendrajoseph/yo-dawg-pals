import { useEffect, useState } from "react";
import { Bot, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { SettingsLayout } from "./SettingsLayout";

type LinkRow = {
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  linked_at: string;
  digest_enabled: boolean;
  digest_hour_local: number;
  digest_timezone: string;
};

const BOT_USERNAME = "yodawg_bot"; // Replace with AJ's actual bot username after setup

export default function TelegramSettings() {
  const { user } = useAuth();
  const [link, setLink] = useState<LinkRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("sitter_telegram_links")
      .select("telegram_chat_id, telegram_username, telegram_first_name, linked_at, digest_enabled, digest_hour_local, digest_timezone")
      .eq("sitter_id", user.id)
      .maybeSingle();

    if (data && data.telegram_chat_id && Number(data.telegram_chat_id) > 0) {
      setLink(data as LinkRow);
    } else {
      setLink(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const generateToken = async () => {
    setGenerating(true);
    const { data, error } = await supabase.rpc("create_telegram_link_token");
    setGenerating(false);
    if (error || !data) {
      toast({ title: "Couldn't generate code", description: error?.message, variant: "destructive" });
      return;
    }
    setToken(data as string);
    setTokenExpiresAt(new Date(Date.now() + 15 * 60 * 1000));

    const startedAt = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        clearInterval(poll);
        return;
      }
      const { data: row } = await supabase
        .from("sitter_telegram_links")
        .select("telegram_chat_id")
        .eq("sitter_id", user!.id)
        .maybeSingle();
      if (row && row.telegram_chat_id && Number(row.telegram_chat_id) > 0) {
        clearInterval(poll);
        setToken(null);
        toast({ title: "Telegram connected ✓", description: "You're all set." });
        await load();
      }
    }, 3000);
  };

  const copyCommand = () => {
    if (!token) return;
    navigator.clipboard.writeText(`/link ${token}`);
    toast({ title: "Copied" });
  };

  const openBot = () => {
    window.open(`https://t.me/${BOT_USERNAME}`, "_blank");
  };

  const updatePref = async (patch: Partial<LinkRow>) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("sitter_telegram_links")
      .update(patch)
      .eq("sitter_id", user.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  const disconnect = async () => {
    if (!user?.id) return;
    if (!confirm("Disconnect Telegram? You can reconnect anytime.")) return;
    const { error } = await supabase
      .from("sitter_telegram_links")
      .delete()
      .eq("sitter_id", user.id);
    if (error) {
      toast({ title: "Couldn't disconnect", description: error.message, variant: "destructive" });
      return;
    }
    setLink(null);
    toast({ title: "Disconnected" });
  };

  return (
    <SettingsLayout
      title="Telegram"
      description="Get your nightly schedule and log pickups with one tap, directly in Telegram."
    >
      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : link ? (
        <ConnectedState
          link={link}
          onUpdatePref={updatePref}
          onDisconnect={disconnect}
        />
      ) : (
        <DisconnectedState
          token={token}
          tokenExpiresAt={tokenExpiresAt}
          generating={generating}
          onGenerate={generateToken}
          onOpenBot={openBot}
          onCopyCommand={copyCommand}
        />
      )}
    </SettingsLayout>
  );
}

function DisconnectedState({
  token,
  tokenExpiresAt,
  generating,
  onGenerate,
  onOpenBot,
  onCopyCommand,
}: {
  token: string | null;
  tokenExpiresAt: Date | null;
  generating: boolean;
  onGenerate: () => void;
  onOpenBot: () => void;
  onCopyCommand: () => void;
}) {
  return (
    <Card className="p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2"><Bot className="h-5 w-5" /></div>
        <div className="flex-1">
          <h3 className="font-display text-lg">Connect your Telegram</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps. Takes about a minute.
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-5">
        <li>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl text-primary">1.</span>
            <div className="flex-1">
              <p className="text-sm">Open the Yo Dawg bot in Telegram.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onOpenBot}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Open @{BOT_USERNAME}
              </Button>
            </div>
          </div>
        </li>

        <li>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl text-primary">2.</span>
            <div className="flex-1">
              <p className="text-sm">Generate your one-time link code.</p>
              {!token ? (
                <Button size="sm" className="mt-2" onClick={onGenerate} disabled={generating}>
                  {generating ? "Generating…" : "Generate code"}
                </Button>
              ) : (
                <div className="mt-2 rounded-md border-2 border-primary bg-card p-3">
                  <code className="font-mono text-base text-primary">/link {token}</code>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={onCopyCommand}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Expires {tokenExpiresAt?.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </li>

        <li>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl text-primary">3.</span>
            <div className="flex-1">
              <p className="text-sm">
                Paste the <code className="rounded bg-muted px-1 py-0.5 text-xs">/link …</code> command into the chat with the bot and send it.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This page will refresh automatically once you're connected.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </Card>
  );
}

function ConnectedState({
  link,
  onUpdatePref,
  onDisconnect,
}: {
  link: LinkRow;
  onUpdatePref: (patch: Partial<LinkRow>) => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <Card className="p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-display text-lg">Connected</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {link.telegram_first_name || link.telegram_username || "Telegram account"}
              {" "}— linked {new Date(link.linked_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-6 shadow-soft">
        <h3 className="font-display text-lg">Nightly schedule digest</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sent to Telegram (and as an email backup) the evening before, with tap-to-log buttons.
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <Label htmlFor="digest-enabled" className="flex-1 cursor-pointer">
            <div className="font-medium">Enabled</div>
            <div className="text-xs text-muted-foreground">Turn off to pause the nightly send.</div>
          </Label>
          <Switch
            id="digest-enabled"
            checked={link.digest_enabled}
            onCheckedChange={(c) => onUpdatePref({ digest_enabled: c })}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase">Send hour (local)</Label>
            <Select
              value={String(link.digest_hour_local)}
              onValueChange={(v) => onUpdatePref({ digest_hour_local: parseInt(v) })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[18, 19, 20, 21, 22].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {new Date(0, 0, 0, h, 0).toLocaleTimeString("en-CA", { hour: "numeric", hour12: true })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase">Timezone</Label>
            <Select
              value={link.digest_timezone}
              onValueChange={(v) => onUpdatePref({ digest_timezone: v })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Toronto">Toronto / Eastern</SelectItem>
                <SelectItem value="America/Vancouver">Vancouver / Pacific</SelectItem>
                <SelectItem value="America/Edmonton">Edmonton / Mountain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-6 shadow-soft">
        <h3 className="font-display text-lg">Available commands</h3>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li><code className="rounded bg-muted px-1.5 py-0.5">/today</code> — see today's schedule</li>
          <li><code className="rounded bg-muted px-1.5 py-0.5">/tomorrow</code> — see tomorrow's schedule</li>
          <li><code className="rounded bg-muted px-1.5 py-0.5">/undo</code> — reverse your last logged update</li>
          <li><code className="rounded bg-muted px-1.5 py-0.5">/help</code> — show command list</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          You can also send any free-form message and we'll route you to the AI scheduler with your message preloaded.
        </p>
      </Card>

      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={onDisconnect} className="text-destructive">
          Disconnect Telegram
        </Button>
      </div>
    </>
  );
}
