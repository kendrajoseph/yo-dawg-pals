Wire up the existing `NewInvoiceDialog` component to the Invoices page so sitters can create manual invoices.

**Changes needed:**
1. Import `NewInvoiceDialog` into `src/pages/sitter/Invoices.tsx`
2. Add state for `newInvoiceOpen` and a handler for when an invoice is created
3. Add a "New invoice" button in the page header (next to the title)
4. On creation, close the dialog and refresh the invoice list

No new components or database changes needed — this connects existing code.