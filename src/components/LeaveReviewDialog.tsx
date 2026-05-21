import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StarRating } from "@/components/StarRating";
import { toast } from "@/hooks/use-toast";

type Props = {
  bookingId: string;
  customerId: string;
  sitterId: string;
  serviceLabel: string;
  petName?: string | null;
  onSubmitted?: () => void;
  defaultOpen?: boolean;
  triggerLabel?: string;
};

type ExistingReview = {
  id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  service_feedback: string | null;
  value_feedback: string | null;
  improvement_feedback: string | null;
};

export function LeaveReviewDialog({ bookingId, customerId, sitterId, serviceLabel, petName, onSubmitted, defaultOpen, triggerLabel }: Props) {
  const db = supabase as any;
  const [open, setOpen] = useState(!!defaultOpen);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [serviceFeedback, setServiceFeedback] = useState("");
  const [valueFeedback, setValueFeedback] = useState("");
  const [improvementFeedback, setImprovementFeedback] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db
        .from("client_reviews")
        .select("id, rating, comment, is_anonymous, service_feedback, value_feedback, improvement_feedback")
        .eq("booking_id", bookingId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setExisting(data);
        setRating(data.rating);
        setComment(data.comment ?? "");
        setServiceFeedback(data.service_feedback ?? "");
        setValueFeedback(data.value_feedback ?? "");
        setImprovementFeedback(data.improvement_feedback ?? "");
        setAnonymous(data.is_anonymous);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [bookingId, customerId, db]);

  const submit = async () => {
    if (rating < 1) {
      toast({ title: "Pick a rating", description: "Tap a star from 1 to 5.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      booking_id: bookingId,
      customer_id: customerId,
      sitter_id: sitterId,
      rating,
      comment: comment.trim() || null,
      service_feedback: serviceFeedback.trim() || null,
      value_feedback: valueFeedback.trim() || null,
      improvement_feedback: improvementFeedback.trim() || null,
      is_anonymous: anonymous,
    };
    const { error, data } = existing
      ? await db.from("client_reviews").update(payload).eq("id", existing.id).select().maybeSingle()
      : await db.from("client_reviews").insert(payload).select().maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save review", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: existing ? "Review updated" : "Thanks for the review!", description: "AJ will see your feedback." });
    if (data) setExisting(data);
    setOpen(false);
    onSubmitted?.();
  };

  if (!loaded) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-2 border-primary font-display uppercase">
          <Star className="h-4 w-4" /> {triggerLabel ?? (existing ? "Edit review" : "Rate service")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Update your review" : "How was your service?"}</DialogTitle>
          <DialogDescription>
            {serviceLabel}{petName ? ` for ${petName}` : ""}. Your feedback is private — only AJ will see it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-display text-xs uppercase text-primary">Overall rating</Label>
            <div className="mt-2"><StarRating value={rating} onChange={setRating} size="lg" /></div>
          </div>
          <div>
            <Label htmlFor="rev-service" className="font-display text-xs uppercase text-primary">How was the quality of service?</Label>
            <Textarea
              id="rev-service"
              value={serviceFeedback}
              onChange={(e) => setServiceFeedback(e.target.value)}
              placeholder="Care, communication, attention to your pet…"
              className="mt-2 min-h-[80px]"
              maxLength={1000}
            />
          </div>
          <div>
            <Label htmlFor="rev-value" className="font-display text-xs uppercase text-primary">Was it good value for the price?</Label>
            <Textarea
              id="rev-value"
              value={valueFeedback}
              onChange={(e) => setValueFeedback(e.target.value)}
              placeholder="Did the price match the experience?"
              className="mt-2 min-h-[80px]"
              maxLength={1000}
            />
          </div>
          <div>
            <Label htmlFor="rev-improve" className="font-display text-xs uppercase text-primary">What could we improve?</Label>
            <Textarea
              id="rev-improve"
              value={improvementFeedback}
              onChange={(e) => setImprovementFeedback(e.target.value)}
              placeholder="Anything we could do better next time?"
              className="mt-2 min-h-[80px]"
              maxLength={1000}
            />
          </div>
          <div>
            <Label htmlFor="review-comment" className="font-display text-xs uppercase text-primary">Anything else? (optional)</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Other thoughts…"
              className="mt-2 min-h-[80px]"
              maxLength={2000}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} />
            <span>Submit this review anonymously</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="font-display uppercase shadow-pop-accent">
            {saving ? "Saving…" : existing ? "Save changes" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
