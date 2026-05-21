import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandFooter } from './_brand-footer.tsx'

const SITE_NAME = 'Yo Dawg Services'

interface LineItem { label: string; quantity?: number; total_cents: number }

interface ReceiptProps {
  customerName?: string
  invoiceNumber?: string
  receiptNumber?: string
  paidAt?: string
  amountPaidCents?: number
  paymentMethod?: string
  lineItems?: LineItem[]
}

const formatMoney = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`
const formatDate = (s?: string) => {
  if (!s) return ''
  try { return new Date(s).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return s }
}

const PaymentReceiptEmail = ({
  customerName = 'there',
  invoiceNumber = '',
  receiptNumber = '',
  paidAt,
  amountPaidCents = 0,
  paymentMethod = '',
  lineItems = [],
}: ReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Receipt for {formatMoney(amountPaidCents)} — thank you!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={banner}>
          <Heading style={h1}>✓ Payment received</Heading>
        </Section>

        <Text style={text}>Thanks {customerName}! Your payment of <strong>{formatMoney(amountPaidCents)}</strong> has been received.</Text>

        <Section style={card}>
          <div style={metaRow}><Text style={label}>Receipt</Text><Text style={value}>{receiptNumber}</Text></div>
          {invoiceNumber ? <div style={metaRow}><Text style={label}>Invoice</Text><Text style={value}>{invoiceNumber}</Text></div> : null}
          <div style={metaRow}><Text style={label}>Paid</Text><Text style={value}>{formatDate(paidAt)}</Text></div>
          {paymentMethod ? <div style={metaRow}><Text style={label}>Method</Text><Text style={value}>{paymentMethod}</Text></div> : null}
        </Section>

        {lineItems.length > 0 ? (
          <Section style={card}>
            {lineItems.map((li, i) => (
              <React.Fragment key={i}>
                <div style={lineRow}>
                  <Text style={lineLabel}>{li.label}{li.quantity && li.quantity !== 1 ? ` × ${li.quantity}` : ''}</Text>
                  <Text style={lineAmount}>{formatMoney(li.total_cents)}</Text>
                </div>
                {i < lineItems.length - 1 ? <Hr style={hr} /> : null}
              </React.Fragment>
            ))}
            <Hr style={hrBold} />
            <div style={lineRow}>
              <Text style={totalLabel}>Paid</Text>
              <Text style={totalAmount}>{formatMoney(amountPaidCents)}</Text>
            </div>
          </Section>
        ) : null}

        <Text style={footer}>Keep this email for your records.</Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentReceiptEmail,
  subject: (d: Record<string, any>) => `Receipt — ${SITE_NAME}`,
  displayName: 'Payment receipt',
  previewData: {
    customerName: 'Sam',
    invoiceNumber: 'INV-2026-0001',
    receiptNumber: 'RCP-2026-0001',
    paidAt: '2026-04-25T14:00:00Z',
    amountPaidCents: 12000,
    paymentMethod: 'Visa ending in 4242',
    lineItems: [
      { label: 'Boarding · first night', total_cents: 8000 },
      { label: 'Boarding · additional', total_cents: 6000 },
      { label: 'Sibling discount', total_cents: -2000 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const banner = { backgroundColor: '#1f5d3a', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#fdf6e9', margin: '0' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.55', margin: '0 0 18px' }
const card = { border: '1px solid #e6e2d6', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfbf5', marginBottom: '14px' }
const metaRow = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#7c7766', margin: '0', fontWeight: 600 }
const value = { fontSize: '13px', color: '#0f1c33', margin: '0', fontWeight: 500 }
const lineRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }
const lineLabel = { fontSize: '14px', color: '#1a2742', margin: '6px 0', flex: 1 }
const lineAmount = { fontSize: '14px', color: '#1a2742', margin: '6px 0', fontWeight: 500 }
const totalLabel = { fontSize: '15px', color: '#0f1c33', margin: '8px 0', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const totalAmount = { fontSize: '18px', color: '#0f1c33', margin: '8px 0', fontWeight: 700 }
const hr = { borderColor: '#ece7d6', margin: '4px 0' }
const hrBold = { borderColor: '#0f1c33', borderTopWidth: '2px', margin: '12px 0 4px' }
const footer = { fontSize: '12px', color: '#7c7766', margin: '20px 0 0', textAlign: 'center' as const }
