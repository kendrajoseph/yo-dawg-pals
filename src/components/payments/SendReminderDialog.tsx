import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { tone: "friendly" | "firm" | "final"; channel: "email" | "sms" | "both" }) => Promise<void> | void;
};

export function SendReminderDialog({ open, onOpenChange, onSubmit }: Props) {
  const [tone, setTone] = useState<"friendly" | "firm" | "final">("friendly");
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email && !sms) return;
    setSubmitting(true);
    try {
      const channel = email && sms ? "both" : email ? "email" : "sms";
      await onSubmit({ tone, channel });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-primary">Send payment reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly nudge</SelectItem>
                <SelectItem value="firm">Firm reminder</SelectItem>
                <SelectItem value="final">Final notice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={email} onCheckedChange={(c) => setEmail(c === true)} /> Email</label>
            <label className="flex items-center gap-2"><Checkbox checked={sms} onCheckedChange={(c) => setSms(c === true)} /> Text</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || (!email && !sms)}>{submitting ? "Sending…" : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
