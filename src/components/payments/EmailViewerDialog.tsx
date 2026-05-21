import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: string | null;
  html?: string | null;
  sentAt?: string | null;
};

export function EmailViewerDialog({ open, onOpenChange, subject, html, sentAt }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="truncate">{subject ?? "Email"}</DialogTitle>
          <DialogDescription>
            Exactly what your client received{sentAt ? ` · ${new Date(sentAt).toLocaleString()}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[70vh] w-full bg-muted">
          {html ? (
            <iframe
              title={subject ?? "Email preview"}
              srcDoc={html}
              sandbox=""
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              No rendered email is stored for this item.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
