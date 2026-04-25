import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Yo Dawg Services'

type Tone = 'friendly' | 'firm' | 'final'

interface ReminderProps {
  customerName?: string
  invoiceNumber?: string
  dueDate?: string
  amountDueCents?: number
  payUrl?: string
  tone?: Tone
  daysOverdue?: number
}

const formatMoney = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`
const formatDate = (s?: string) => {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return s }
}

const COPY: Record<Tone, { heading: string; body: (name: string, due: string, days: number) => string; subject: (inv: string) => string }> = {
  friendly: {
    heading: 'Friendly reminder',
    body: (name, due) => `Hi ${name}, just a quick nudge that your invoice is due ${due}. No rush — let me know if you have any questions!`,
    subject: (inv) => `Friendly reminder — invoice ${inv}`,
  },
  firm: {
    heading: 'Payment reminder',
    body: (name, due, days) => `Hi ${name}, your invoice was due ${due}${days > 0 ? ` (${days} day${days === 1 ? '' : 's'} ago)` : ''}. Please settle when you can.`,
    subject: (inv) => `Reminder — invoice ${inv} is past due`,
  },
  final: {
    heading: 'Final notice',
    body: (name, due, days) => `Hi ${name}, this is a final notice: your invoice has been outstanding since ${due}${days > 0 ? ` (${days} days)` : ''}. Please pay today to avoid service interruption.`,
    subject: (inv) => `Final notice — invoice ${inv}`,
  },
}

const PaymentReminderEmail = ({
  customerName = 'there',
  invoiceNumber = '',
  dueDate,
  amountDueCents = 0,
  payUrl = '#',
  tone = 'friendly',
  daysOverdue = 0,
}: ReminderProps) => {
  const c = COPY[tone] ?? COPY.friendly
  const headingColor = tone === 'final' ? '#7a1d1d' : tone === 'firm' ? '#8a5a1d' : '#0f1c33'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{c.heading} — {formatMoney(amountDueCents)} due</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...banner, backgroundColor: headingColor }}>
            <Heading style={h1}>{c.heading}</Heading>
          </Section>

          <Text style={text}>{c.body(customerName, formatDate(dueDate), daysOverdue)}</Text>

          <Section style={card}>
            <Text style={label}>Invoice</Text>
            <Text style={value}>{invoiceNumber}</Text>
            <Text style={{ ...label, marginTop: '12px' }}>Amount due</Text>
            <Text style={amount}>{formatMoney(amountDueCents)}</Text>
          </Section>

          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={payUrl} style={button}>Pay {formatMoney(amountDueCents)}</Button>
          </Section>

          <Text style={footer}>Or copy: <Link href={payUrl} style={linkStyle}>{payUrl}</Link></Text>
          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PaymentReminderEmail,
  subject: (d: Record<string, any>) => (COPY[d?.tone as Tone] ?? COPY.friendly).subject(d?.invoiceNumber ?? ''),
  displayName: 'Payment reminder',
  previewData: {
    customerName: 'Sam',
    invoiceNumber: 'INV-2026-0001',
    dueDate: '2026-04-22',
    amountDueCents: 12000,
    payUrl: 'https://yodawg.ca/pay/abcdef123',
    tone: 'friendly',
    daysOverdue: 3,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const banner = { borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#fdf6e9', margin: '0' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.55', margin: '0 0 18px' }
const card = { border: '1px solid #e6e2d6', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfbf5', marginBottom: '18px' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#7c7766', margin: '0 0 4px', fontWeight: 600 }
const value = { fontSize: '15px', color: '#0f1c33', margin: '0', fontWeight: 500 }
const amount = { fontSize: '24px', color: '#0f1c33', margin: '0', fontWeight: 700 }
const button = { backgroundColor: '#0f1c33', color: '#fdf6e9', padding: '14px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const footer = { fontSize: '12px', color: '#7c7766', margin: '12px 0 0', textAlign: 'center' as const }
const linkStyle = { color: '#0f1c33', textDecoration: 'underline' }
