import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { formatCents, type Invoice, type InvoiceLineItem } from "./invoices";

export type InvoicePdfPayload = {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  business: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    payment_instructions: string | null;
    invoice_footer: string | null;
  };
};

const PAGE_MARGIN = 48;

export function downloadInvoicePdf(payload: InvoicePdfPayload) {
  const { invoice, lineItems, customerName, customerEmail, customerPhone, business } = payload;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN;

  // Business header (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(business.name || "Invoice", PAGE_MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const businessLines = [
    business.address,
    business.email,
    business.phone,
  ].filter(Boolean) as string[];
  for (const line of businessLines.flatMap((l) => l.split(/\r?\n/))) {
    doc.text(line, PAGE_MARGIN, y);
    y += 13;
  }

  // Invoice meta (right, top)
  let metaY = PAGE_MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("INVOICE", pageW - PAGE_MARGIN, metaY, { align: "right" });
  metaY += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metaPairs: [string, string][] = [
    ["Invoice #", invoice.invoice_number],
    ["Issued", invoice.created_at ? format(new Date(invoice.created_at), "MMM d, yyyy") : "—"],
    ["Due", invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "On receipt"],
    ["Status", (invoice.status || "draft").toUpperCase()],
  ];
  for (const [k, v] of metaPairs) {
    doc.text(`${k}:`, pageW - PAGE_MARGIN - 100, metaY, { align: "left" });
    doc.text(v, pageW - PAGE_MARGIN, metaY, { align: "right" });
    metaY += 13;
  }

  y = Math.max(y, metaY) + 12;

  // Bill to
  doc.setDrawColor(220);
  doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", PAGE_MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const billToLines = [
    customerName || "Customer",
    customerEmail || "",
    customerPhone || "",
  ].filter(Boolean);
  for (const line of billToLines) {
    doc.text(line, PAGE_MARGIN, y);
    y += 13;
  }
  y += 10;

  // Line items table
  doc.setDrawColor(220);
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_MARGIN, y, pageW - PAGE_MARGIN * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", PAGE_MARGIN + 8, y + 14);
  doc.text("Qty", pageW - PAGE_MARGIN - 220, y + 14, { align: "right" });
  doc.text("Unit", pageW - PAGE_MARGIN - 110, y + 14, { align: "right" });
  doc.text("Total", pageW - PAGE_MARGIN - 8, y + 14, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const li of lineItems) {
    if (y > 720) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    const labelLines = doc.splitTextToSize(li.label, pageW - PAGE_MARGIN * 2 - 240);
    doc.text(labelLines, PAGE_MARGIN + 8, y + 14);
    doc.text(String(li.quantity), pageW - PAGE_MARGIN - 220, y + 14, { align: "right" });
    doc.text(formatCents(li.unit_price_cents), pageW - PAGE_MARGIN - 110, y + 14, { align: "right" });
    doc.text(formatCents(li.total_cents), pageW - PAGE_MARGIN - 8, y + 14, { align: "right" });
    const rowH = Math.max(20, labelLines.length * 13 + 8);
    y += rowH;
    doc.setDrawColor(235);
    doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
  }
  y += 10;

  // Totals box
  const totalsX = pageW - PAGE_MARGIN - 220;
  doc.setFontSize(10);
  const owed = (invoice.total_cents ?? 0) - (invoice.amount_paid_cents ?? 0);
  const totalsRows: [string, string, boolean?][] = [
    ["Subtotal", formatCents(invoice.subtotal_cents)],
    ["Total", formatCents(invoice.total_cents), true],
  ];
  if ((invoice.amount_paid_cents ?? 0) > 0) {
    totalsRows.push(["Amount paid", `-${formatCents(invoice.amount_paid_cents)}`]);
    totalsRows.push(["Balance due", formatCents(owed), true]);
  }
  for (const [label, val, bold] of totalsRows) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, y + 12);
    doc.text(val, pageW - PAGE_MARGIN - 8, y + 12, { align: "right" });
    y += 16;
  }
  y += 10;

  // Notes / payment instructions / footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", PAGE_MARGIN, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(invoice.notes, pageW - PAGE_MARGIN * 2);
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 12 + 8;
  }
  if (business.payment_instructions) {
    doc.setFont("helvetica", "bold");
    doc.text("Payment instructions", PAGE_MARGIN, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(business.payment_instructions, pageW - PAGE_MARGIN * 2);
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 12 + 8;
  }
  if (business.invoice_footer) {
    doc.setTextColor(120);
    const lines = doc.splitTextToSize(business.invoice_footer, pageW - PAGE_MARGIN * 2);
    doc.text(lines, PAGE_MARGIN, y);
    doc.setTextColor(0);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
