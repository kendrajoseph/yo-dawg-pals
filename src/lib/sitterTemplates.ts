// Default templates and variable helpers for sitter messaging.
// Stored client-side as fallbacks; the database only stores customised versions.

export type TemplateKind =
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_reminder"
  | "invoice_overdue"
  | "booking_requested"
  | "booking_approved"
  | "booking_declined";

export type TemplateChannel = "email" | "sms";

export type TemplateDef = {
  kind: TemplateKind;
  channel: TemplateChannel;
  category: "Invoices" | "Bookings";
  label: string;
  description: string;
  defaultSubject?: string;
  defaultBody: string;
  variables: string[];
};

const INVOICE_VARS = [
  "customer_name",
  "invoice_number",
  "amount",
  "due_date",
  "pay_url",
  "business_name",
];

const BOOKING_VARS = [
  "customer_name",
  "service_name",
  "date",
  "time",
  "business_name",
];

export const TEMPLATES: TemplateDef[] = [
  {
    kind: "invoice_sent",
    channel: "email",
    category: "Invoices",
    label: "Invoice sent",
    description: "Sent the moment a new invoice goes out.",
    defaultSubject: "Invoice {{invoice_number}} from {{business_name}}",
    defaultBody:
      "Hi {{customer_name}},\n\nThanks for your business! Your invoice {{invoice_number}} for {{amount}} is ready.\n\nPay securely here: {{pay_url}}\n\nDue {{due_date}}.\n\nThanks,\n{{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "invoice_paid",
    channel: "email",
    category: "Invoices",
    label: "Payment received",
    description: "Receipt sent automatically when an invoice is paid.",
    defaultSubject: "Receipt for invoice {{invoice_number}}",
    defaultBody:
      "Hi {{customer_name}},\n\nWe received your payment of {{amount}} for invoice {{invoice_number}}. Thanks so much!\n\n{{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "invoice_reminder",
    channel: "email",
    category: "Invoices",
    label: "Reminder",
    description: "Friendly nudge before or on the due date.",
    defaultSubject: "Friendly reminder: invoice {{invoice_number}}",
    defaultBody:
      "Hi {{customer_name}},\n\nJust a quick reminder that invoice {{invoice_number}} for {{amount}} is due {{due_date}}.\n\nPay here: {{pay_url}}\n\nThanks,\n{{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "invoice_overdue",
    channel: "email",
    category: "Invoices",
    label: "Overdue notice",
    description: "Stronger reminder once an invoice passes its due date.",
    defaultSubject: "Overdue: invoice {{invoice_number}}",
    defaultBody:
      "Hi {{customer_name}},\n\nInvoice {{invoice_number}} for {{amount}} was due {{due_date}} and is now overdue. Please settle it at your earliest convenience.\n\nPay here: {{pay_url}}\n\nReply if there's anything I can help with.\n\n{{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "booking_requested",
    channel: "email",
    category: "Bookings",
    label: "Request received",
    description: "Confirms you got the customer's request.",
    defaultSubject: "We got your booking request",
    defaultBody:
      "Hi {{customer_name}},\n\nThanks for your booking request for {{service_name}} on {{date}} at {{time}}. I'll review and get back to you shortly.\n\n{{business_name}}",
    variables: BOOKING_VARS,
  },
  {
    kind: "booking_approved",
    channel: "email",
    category: "Bookings",
    label: "Request approved",
    description: "Sent when you approve a booking request.",
    defaultSubject: "Your booking is confirmed",
    defaultBody:
      "Hi {{customer_name}},\n\nYour booking for {{service_name}} on {{date}} at {{time}} is confirmed. Looking forward to it!\n\n{{business_name}}",
    variables: BOOKING_VARS,
  },
  {
    kind: "booking_declined",
    channel: "email",
    category: "Bookings",
    label: "Request declined",
    description: "Sent when you can't take a booking.",
    defaultSubject: "Update on your booking request",
    defaultBody:
      "Hi {{customer_name}},\n\nUnfortunately I can't take your booking for {{service_name}} on {{date}} at {{time}}. Sorry for any inconvenience — please reach out for alternative dates.\n\n{{business_name}}",
    variables: BOOKING_VARS,
  },
  // SMS versions
  {
    kind: "invoice_reminder",
    channel: "sms",
    category: "Invoices",
    label: "Reminder (SMS)",
    description: "Short SMS reminder for unpaid invoices.",
    defaultBody:
      "Hi {{customer_name}}, friendly reminder: invoice {{invoice_number}} ({{amount}}) is due {{due_date}}. Pay: {{pay_url}} — {{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "invoice_overdue",
    channel: "sms",
    category: "Invoices",
    label: "Overdue (SMS)",
    description: "Short SMS for overdue invoices.",
    defaultBody:
      "Hi {{customer_name}}, invoice {{invoice_number}} ({{amount}}) was due {{due_date}} and is now overdue. Pay: {{pay_url}} — {{business_name}}",
    variables: INVOICE_VARS,
  },
  {
    kind: "booking_approved",
    channel: "sms",
    category: "Bookings",
    label: "Approved (SMS)",
    description: "Quick SMS confirmation.",
    defaultBody:
      "Hi {{customer_name}}, your {{service_name}} on {{date}} at {{time}} is confirmed. — {{business_name}}",
    variables: BOOKING_VARS,
  },
  {
    kind: "booking_declined",
    channel: "sms",
    category: "Bookings",
    label: "Declined (SMS)",
    description: "Quick SMS decline.",
    defaultBody:
      "Hi {{customer_name}}, sorry — I can't take your {{service_name}} on {{date}} at {{time}}. Reach out for other dates. — {{business_name}}",
    variables: BOOKING_VARS,
  },
];

export function templateKey(kind: TemplateKind, channel: TemplateChannel) {
  return `${kind}::${channel}`;
}

export function findTemplateDef(kind: TemplateKind, channel: TemplateChannel) {
  return TEMPLATES.find((t) => t.kind === kind && t.channel === channel);
}

export function renderTemplate(text: string, vars: Record<string, string | number | undefined>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

// Default reminder cadence used until the sitter customises it.
export const DEFAULT_REMINDER_RULES: ReminderRule[] = [
  { offset_days: -3, channel: "email", label: "3 days before due" },
  { offset_days: 0, channel: "email", label: "On due date" },
  { offset_days: 7, channel: "email", label: "7 days overdue" },
];

export type ReminderRule = {
  offset_days: number; // negative = before due, positive = after due, 0 = on due date
  channel: TemplateChannel;
  label: string;
};

export function describeRule(rule: ReminderRule): string {
  const days = Math.abs(rule.offset_days);
  const when =
    rule.offset_days === 0
      ? "On due date"
      : rule.offset_days < 0
      ? `${days} day${days === 1 ? "" : "s"} before due`
      : `${days} day${days === 1 ? "" : "s"} after due`;
  return `${when} — ${rule.channel.toUpperCase()}`;
}
