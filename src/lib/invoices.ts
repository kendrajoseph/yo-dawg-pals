export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void" | "partial";

export type Invoice = {
  id: string;
  booking_id: string;
  sitter_id: string;
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  public_token: string;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  label: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  kind: "service" | "extra_time" | "late_fee" | "discount" | "custom" | "tip" | "tax";
  sort_order: number;
  created_at: string;
};

export type PaymentEvent = {
  id: string;
  booking_id: string | null;
  invoice_id: string | null;
  kind: string;
  channel: string | null;
  amount_cents: number | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export const formatCents = (c: number | null | undefined) =>
  `$${((c ?? 0) / 100).toFixed(2)}`;

export const isOverdue = (inv: Pick<Invoice, "status" | "due_date">) => {
  if (inv.status === "paid" || inv.status === "void") return false;
  if (!inv.due_date) return false;
  const due = new Date(inv.due_date + "T23:59:59");
  return due.getTime() < Date.now();
};

export const derivedStatus = (inv: Pick<Invoice, "status" | "due_date">): InvoiceStatus =>
  isOverdue(inv) && inv.status !== "paid" && inv.status !== "void" ? "overdue" : inv.status;

export const statusBadgeClass = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "outstanding":
    case "sent":
    case "draft":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "overdue":
      return "bg-red-100 text-red-800 border-red-200";
    case "refunded":
    case "void":
      return "bg-muted text-muted-foreground border-border";
    case "partial":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};
