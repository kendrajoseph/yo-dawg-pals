import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export type PersonalEventRow = {
  id: string;
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: Date;
  event?: PersonalEventRow | null;
  onSaved?: () => void;
};

const CATEGORIES = ["personal", "appointment", "fitness", "errand", "other"];

const localInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function PersonalEventDialog({ open, onOpenChange, defaultDate, event, onSaved }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState("personal");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      setTitle(event.title);
      setNotes(event.notes ?? "");
      setAllDay(event.all_day);
      setCategory(event.category || "personal");
      setDate(format(s, "yyyy-MM-dd"));
      setStartTime(format(s, "HH:mm"));
      setEndDate(format(e, "yyyy-MM-dd"));
      setEndTime(format(e, "HH:mm"));
    } else {
      const d = defaultDate ?? new Date();
      setTitle("");
      setNotes("");
      setAllDay(false);
      setCategory("personal");
      setDate(format(d, "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndDate(format(d, "yyyy-MM-dd"));
      setEndTime("10:00");
    }
  }, [open, event, defaultDate]);

  const save = async () => {
    if (!user?.id) return;
    if (!title.trim()) {
      toast({ title: "Add a title", variant: "destructive" });
      return;
    }
    const start = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}:00`);
    const end = allDay ? new Date(`${endDate}T23:59:59`) : new Date(`${endDate}T${endTime}:00`);
    if (end < start) {
      toast({ title: "End must be after start", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      sitter_id: user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      all_day: allDay,
      category,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };
    const { error } = event
      ? await (supabase as any).from("personal_events").update(payload).eq("id", event.id)
      : await (supabase as any).from("personal_events").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: event ? "Event updated" : "Event added" });
    onOpenChange(false);
    onSaved?.();
  };

  const remove = async () => {
    if (!event) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("personal_events").delete().eq("id", event.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Event removed" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit personal event" : "Add personal event"}</DialogTitle>
          <DialogDescription>Personal items only show on your calendar — clients never see them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pe-title">Title</Label>
            <Input id="pe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Doctor appointment" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2">
              <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
              <span className="text-sm">All day</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {!allDay && (
              <div>
                <Label>Start time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            )}
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {!allDay && (
              <div>
                <Label>End time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="pe-notes">Notes</Label>
            <Textarea id="pe-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional details…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {event && (
            <Button variant="ghost" onClick={remove} disabled={deleting || saving} className="mr-auto text-destructive">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancel</Button>
          <Button onClick={save} disabled={saving || deleting}>{saving ? "Saving…" : event ? "Save changes" : "Add to calendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
