import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Yo Dawg Services'

interface LineItem { label: string; quantity?: number; total_cents: number }

interface InvoiceIssuedProps {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  invoiceNumber?: string
  dueDate?: string
  totalCents?: number
  lineItems?: LineItem[]
  payUrl?: string
  notes?: string
}

const formatMoney = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`
const formatDate = (s?: string) => {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) } catch { return s }
}

const InvoiceIssuedEmail = ({
  customerName = 'there',
  customerEmail,
  customerPhone,
  invoiceNumber = '',
  dueDate,
  totalCents = 0,
  lineItems = [],
  payUrl = '#',
  notes = '',
}: InvoiceIssuedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Invoice {invoiceNumber} — {formatMoney(totalCents)} due</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={banner}>
          <Heading style={h1}>Invoice {invoiceNumber}</Heading>
        </Section>

        <Text style={text}>Hi {customerName}, here's your invoice from {SITE_NAME}.</Text>

        <Section style={billTo}>
          <Text style={billToLabel}>Billed to</Text>
          <Text style={billToName}>{customerName}</Text>
          {customerEmail ? <Text style={billToLine}>{customerEmail}</Text> : null}
          {customerPhone ? <Text style={billToLine}>{customerPhone}</Text> : null}
        </Section>

        <Section style={card}>
          {lineItems.map((li, i) => (
            <React.Fragment key={i}>
              <div style={lineRow}>
                <Text style={lineLabel}>
                  {li.label}{li.quantity && li.quantity !== 1 ? ` × ${li.quantity}` : ''}
                </Text>
                <Text style={lineAmount}>{formatMoney(li.total_cents)}</Text>
              </div>
              {i < lineItems.length - 1 ? <Hr style={hr} /> : null}
            </React.Fragment>
          ))}
          <Hr style={hrBold} />
          <div style={lineRow}>
            <Text style={totalLabel}>Total</Text>
            <Text style={totalAmount}>{formatMoney(totalCents)}</Text>
          </div>
          {dueDate ? <Text style={dueText}>Due {formatDate(dueDate)}</Text> : null}
        </Section>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={payUrl} style={button}>Pay {formatMoney(totalCents)}</Button>
        </Section>

        {notes ? <Text style={notesStyle}>{notes}</Text> : null}

        <Text style={footer}>
          Or copy this link: <Link href={payUrl} style={linkStyle}>{payUrl}</Link>
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvoiceIssuedEmail,
  subject: (d: Record<string, any>) => `Invoice ${d?.invoiceNumber ?? ''} from ${SITE_NAME}`,
  displayName: 'Invoice issued',
  previewData: {
    customerName: 'Sam',
    invoiceNumber: 'INV-2026-0001',
    dueDate: '2026-05-01',
    totalCents: 12000,
    lineItems: [
      { label: 'Boarding · first night', quantity: 1, total_cents: 8000 },
      { label: 'Boarding · additional nights', quantity: 1, total_cents: 6000 },
      { label: 'Sibling discount', quantity: 1, total_cents: -2000 },
    ],
    payUrl: 'https://yodawg.ca/pay/abcdef123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const banner = { backgroundColor: '#0f1c33', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#fdf6e9', margin: '0' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.55', margin: '0 0 18px' }
const card = { border: '1px solid #e6e2d6', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfbf5', marginBottom: '18px' }
const lineRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }
const lineLabel = { fontSize: '14px', color: '#1a2742', margin: '6px 0', flex: 1 }
const lineAmount = { fontSize: '14px', color: '#1a2742', margin: '6px 0', fontWeight: 500 }
const totalLabel = { fontSize: '15px', color: '#0f1c33', margin: '8px 0', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const totalAmount = { fontSize: '18px', color: '#0f1c33', margin: '8px 0', fontWeight: 700 }
const dueText = { fontSize: '13px', color: '#7c7766', margin: '4px 0 0', textAlign: 'right' as const }
const hr = { borderColor: '#ece7d6', margin: '4px 0' }
const hrBold = { borderColor: '#0f1c33', borderTopWidth: '2px', margin: '12px 0 4px' }
const button = { backgroundColor: '#0f1c33', color: '#fdf6e9', padding: '14px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const notesStyle = { fontSize: '13px', color: '#55607a', fontStyle: 'italic' as const, margin: '0 0 16px', padding: '12px', backgroundColor: '#fdfbf5', borderRadius: '8px' }
const footer = { fontSize: '12px', color: '#7c7766', margin: '12px 0 0', textAlign: 'center' as const }
const linkStyle = { color: '#0f1c33', textDecoration: 'underline' }
