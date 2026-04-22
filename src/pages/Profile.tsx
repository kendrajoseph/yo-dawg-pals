import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, LogOut, Save, ArrowLeft, Smartphone } from "lucide-react";
import { toast } from "sonner";

const phoneField = z
  .string()
  .trim()
  .max(30, "Phone must be 30 characters or less")
  .regex(/^[\d\s()+\-.]*$/, "Phone can only contain digits, spaces, and ()+-.")
  .optional()
  .or(z.literal(""));

const profileSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or less"),
    phone: phoneField,
    mobile_phone: phoneField,
    sms_opt_in: z.boolean(),
    bio: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or less")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => !data.sms_opt_in || Boolean(data.mobile_phone?.trim()), {
    message: "Add a mobile number before turning on text updates",
    path: ["mobile_phone"],
  });

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    mobile_phone: "",
    sms_opt_in: false,
    bio: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, bio, avatar_url, created_at, mobile_phone, sms_opt_in")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Could not load profile");
      } else if (data) {
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          mobile_phone: (data as { mobile_phone?: string | null }).mobile_phone ?? "",
          sms_opt_in: Boolean((data as { sms_opt_in?: boolean | null }).sms_opt_in),
          bio: data.bio ?? "",
        });
        setAvatarUrl(data.avatar_url);
        setCreatedAt(data.created_at);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updErr) {
      toast.error("Couldn't save avatar");
    } else {
      setAvatarUrl(publicUrl);
      toast.success("Avatar updated");
    }
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const result = profileSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: result.data.full_name,
        phone: result.data.phone || null,
        mobile_phone: result.data.mobile_phone || null,
        sms_opt_in: result.data.sms_opt_in,
        bio: result.data.bio || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Couldn't save: " + error.message);
    } else {
      toast.success(result.data.sms_opt_in ? "Profile saved. Text updates are on." : "Profile saved");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = (form.full_name || user?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <Link
          to="/account"
          className="inline-flex items-center gap-1 font-display text-sm uppercase text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to account
        </Link>

        <div className="mt-4">
          <span className="font-tag text-2xl text-clay">about you</span>
          <h1 className="font-display text-5xl text-primary sm:text-6xl">My profile.</h1>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card className="mt-8 -rotate-[0.5deg] border-4 border-primary p-6 shadow-pop sm:p-8">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-primary">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="Your avatar" />}
                      <AvatarFallback className="bg-accent font-display text-2xl uppercase text-accent-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border-2 border-primary bg-accent text-accent-foreground shadow-pop transition-transform hover:scale-105 disabled:opacity-60"
                      aria-label="Upload avatar"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="font-tag text-xl text-clay">
                      {uploading ? "uploading…" : "tap the camera to change"}
                    </p>
                    <p className="text-xs text-muted-foreground">PNG or JPG, up to 5MB</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="font-display uppercase">
                    Full name
                  </Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    maxLength={100}
                    className="border-2 border-primary"
                  />
                  {errors.full_name && (
                    <p className="text-sm font-medium text-destructive">{errors.full_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-display uppercase">
                    Email
                  </Label>
                  <Input
                    id="email"
                    value={user?.email ?? ""}
                    disabled
                    className="border-2 border-primary/40 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact us to change the email on your account.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-display uppercase">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      maxLength={30}
                      className="border-2 border-primary"
                    />
                    {errors.phone && (
                      <p className="text-sm font-medium text-destructive">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile_phone" className="font-display uppercase">
                      Mobile for text updates
                    </Label>
                    <Input
                      id="mobile_phone"
                      type="tel"
                      placeholder="(555) 987-6543"
                      value={form.mobile_phone}
                      onChange={(e) => setForm({ ...form, mobile_phone: e.target.value })}
                      maxLength={30}
                      className="border-2 border-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for pickup, drop-off, and quick notes from Anneke.
                    </p>
                    {errors.mobile_phone && (
                      <p className="text-sm font-medium text-destructive">{errors.mobile_phone}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border-2 border-primary bg-card p-4 shadow-pop-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="sms_opt_in" className="font-display uppercase text-primary">
                        Turn on text updates
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Anneke can send simple, personal updates when your dog is picked up, dropped off, or if there is a quick note worth sharing.
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <Checkbox
                          id="sms_opt_in"
                          checked={form.sms_opt_in}
                          onCheckedChange={(checked) => setForm({ ...form, sms_opt_in: checked === true })}
                        />
                        <Label htmlFor="sms_opt_in" className="text-sm text-foreground">
                          Yes, send me organized text updates about my dog’s care.
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-display uppercase">
                    Notes for your sitter
                  </Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    placeholder="Gate codes, parking, building access, anything we should know…"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    maxLength={1000}
                    className="border-2 border-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {errors.bio ? (
                      <span className="font-medium text-destructive">{errors.bio}</span>
                    ) : (
                      <span>Anything that helps your sitter show up prepared.</span>
                    )}
                    <span>{form.bio.length}/1000</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary font-display uppercase shadow-pop-accent sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </Card>

            <Card className="mt-6 rotate-[0.5deg] border-4 border-primary p-6 shadow-pop">
              <h2 className="font-display text-2xl uppercase text-primary">Account</h2>
              {createdAt && (
                <p className="mt-2 text-sm text-foreground/80">
                  Member since{" "}
                  <span className="font-tag text-lg text-clay">
                    {new Date(createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
              )}
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="mt-4 border-2 border-primary font-display uppercase"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </Card>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default Profile;
