import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Yo Dawg Services'

interface BookingPaidNotificationProps {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  petName?: string
  serviceName?: string
  startAt?: string
  endAt?: string
  amountPaid?: string
  paymentType?: string
  notes?: string
  bookingId?: string
}

const formatDateTime = (iso?: string) => {
  if (!iso) return 'TBD'
  try {
    return new Date(iso).toLocaleString('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Toronto',
    })
  } catch {
    return iso
  }
}

const BookingPaidNotificationEmail = ({
  customerName = 'A customer',
  customerEmail = '',
  customerPhone = '',
  petName = 'their pet',
  serviceName = 'a service',
  startAt,
  endAt,
  amountPaid = '',
  paymentType = '',
  notes = '',
  bookingId = '',
}: BookingPaidNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      New paid booking from {customerName} for {petName}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={banner}>
          <Heading style={h1}>🐾 New Paid Booking</Heading>
        </Section>

        <Text style={text}>
          Hi Anneke! You've got a new confirmed booking from {customerName}.
        </Text>

        <Section style={card}>
          <Text style={label}>Service</Text>
          <Text style={value}>{serviceName}</Text>

          <Hr style={hr} />

          <Text style={label}>When</Text>
          <Text style={value}>
            {formatDateTime(startAt)}
            {endAt ? ` → ${formatDateTime(endAt)}` : ''}
          </Text>

          <Hr style={hr} />

          <Text style={label}>Pet</Text>
          <Text style={value}>{petName}</Text>

          <Hr style={hr} />

          <Text style={label}>Customer</Text>
          <Text style={value}>{customerName}</Text>
          {customerEmail ? <Text style={subValue}>{customerEmail}</Text> : null}
          {customerPhone ? <Text style={subValue}>{customerPhone}</Text> : null}

          {amountPaid ? (
            <>
              <Hr style={hr} />
              <Text style={label}>Paid</Text>
              <Text style={value}>
                {amountPaid}
                {paymentType ? ` (${paymentType})` : ''}
              </Text>
            </>
          ) : null}

          {notes ? (
            <>
              <Hr style={hr} />
              <Text style={label}>Notes from customer</Text>
              <Text style={value}>{notes}</Text>
            </>
          ) : null}
        </Section>

        {bookingId ? (
          <Text style={meta}>Booking ID: {bookingId}</Text>
        ) : null}

        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingPaidNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New booking: ${data?.serviceName ?? 'service'} for ${data?.petName ?? 'a pet'}`,
  displayName: 'Booking paid notification (to Anneke)',
  to: 'anneke@yodawg.ca',
  previewData: {
    customerName: 'Sam Patel',
    customerEmail: 'sam@example.com',
    customerPhone: '+1 416 555 0142',
    petName: 'Biscuit',
    serviceName: 'Dog walking',
    startAt: '2026-04-25T14:00:00Z',
    endAt: '2026-04-25T14:30:00Z',
    amountPaid: '$5.00 CAD',
    paymentType: 'Deposit',
    notes: 'Biscuit gets the orange harness from the hook by the door.',
    bookingId: 'b1234567-89ab-cdef-0123-456789abcdef',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px',
}
const banner = {
  backgroundColor: '#0f1c33',
  borderRadius: '14px',
  padding: '20px 24px',
  marginBottom: '20px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#fdf6e9',
  margin: '0',
}
const text = {
  fontSize: '15px',
  color: '#1a2742',
  lineHeight: '1.55',
  margin: '0 0 18px',
}
const card = {
  border: '1px solid #e6e2d6',
  borderRadius: '14px',
  padding: '18px 20px',
  backgroundColor: '#fdfbf5',
  marginBottom: '18px',
}
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#7c7766',
  margin: '0 0 4px',
  fontWeight: 600,
}
const value = {
  fontSize: '15px',
  color: '#0f1c33',
  margin: '0',
  fontWeight: 500,
}
const subValue = {
  fontSize: '13px',
  color: '#55607a',
  margin: '2px 0 0',
}
const hr = {
  borderColor: '#ece7d6',
  margin: '14px 0',
}
const meta = {
  fontSize: '11px',
  color: '#999',
  margin: '0 0 8px',
  fontFamily: 'monospace',
}
const footer = {
  fontSize: '12px',
  color: '#7c7766',
  margin: '20px 0 0',
}
