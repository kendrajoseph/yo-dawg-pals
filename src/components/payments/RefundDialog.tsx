import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxRefundCents: number;
  onSubmit: (data: { amountCents: number; reason: string; notify: boolean }) => Promise<void> | void;
};

export function RefundDialog({ open, onOpenChange, maxRefundCents, onSubmit }: Props) {
  const [amount, setAmount] = useState((maxRefundCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ amountCents: Math.round((Number(amount) || 0) * 100), reason, notify });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-primary">Issue refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount ($) — up to ${(maxRefundCents / 100).toFixed(2)}</Label>
            <Input type="number" step="0.01" max={(maxRefundCents / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cancellation, goodwill credit…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(c) => setNotify(c === true)} /> Email refund confirmation to client
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} variant="destructive">{submitting ? "Refunding…" : "Refund"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
