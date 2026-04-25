import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface RequestLine {
  serviceName: string
  petName: string
  timing: string
  recurrence?: string | null
  priceLabel?: string | null
}

interface Props {
  customerName?: string
  lines?: RequestLine[]
  totalLabel?: string
  notes?: string | null
}

const Email = ({
  customerName = 'there',
  lines = [],
  totalLabel,
  notes,
}: Props) => (
  <Html lang="en">
    <Head />
    <Preview>We got your request — Anneke will be in touch soon</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks, {customerName}! 🐾</Heading>
        <Text style={text}>
          Your request just landed in Anneke's inbox. She'll personally review the details below
          and reach out soon to confirm — usually within a day.
        </Text>

        {lines.length > 0 && (
          <Section style={card}>
            <Text style={cardTitle}>Your request</Text>
            {lines.map((line, idx) => (
              <Section key={idx} style={lineRow}>
                <Text style={lineService}>
                  {line.serviceName} <span style={lineMuted}>· {line.petName}</span>
                </Text>
                <Text style={lineTiming}>{line.timing}</Text>
                {line.recurrence && <Text style={lineMutedRow}>Repeats: {line.recurrence}</Text>}
                {line.priceLabel && <Text style={linePrice}>{line.priceLabel}</Text>}
              </Section>
            ))}
            {totalLabel && (
              <>
                <Hr style={hr} />
                <Text style={totalRow}>
                  Estimated total if approved: <strong>{totalLabel}</strong>
                </Text>
                <Text style={fineprint}>All prices include tax. You won't be charged until Anneke confirms.</Text>
              </>
            )}
          </Section>
        )}

        {notes && (
          <Section style={notesCard}>
            <Text style={cardTitle}>Your note</Text>
            <Text style={text}>{notes}</Text>
          </Section>
        )}

        <Text style={text}>
          Got something to add? Just reply to this email — it goes straight to Anneke.
        </Text>
        <Text style={signoff}>Talk soon,<br />Yo Dawg Services</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'We got your request — Anneke will be in touch',
  displayName: 'Walk request received',
  previewData: {
    customerName: 'Sam',
    lines: [
      { serviceName: 'Group Walk · 60 min', petName: 'Biscuit', timing: 'Fri, Apr 25 · Midday window', priceLabel: '$30.00' },
      { serviceName: 'Group Walk · 60 min', petName: 'Mochi (sibling 50% off)', timing: 'Fri, Apr 25 · Midday window', priceLabel: '$15.00' },
    ],
    totalLabel: '$45.00',
    notes: 'Both dogs love long sniffs — happy to go a bit longer if the group does.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px', border: '1px solid #e6e2d6', borderRadius: '14px', backgroundColor: '#fdfbf5' }
const h1 = { fontSize: '24px', color: '#0f1c33', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.6', margin: '0 0 12px' }
const card = { marginTop: '20px', padding: '16px 18px', backgroundColor: '#ffffff', border: '1px solid #e6e2d6', borderRadius: '10px' }
const notesCard = { marginTop: '16px', padding: '14px 18px', backgroundColor: '#fff8e8', border: '1px solid #f0e2b5', borderRadius: '10px' }
const cardTitle = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#7a7560', margin: '0 0 10px' }
const lineRow = { padding: '8px 0', borderBottom: '1px dashed #ece7d6' }
const lineService = { fontSize: '15px', color: '#0f1c33', margin: '0 0 2px', fontWeight: 600 }
const lineMuted = { color: '#7a7560', fontWeight: 400 }
const lineTiming = { fontSize: '14px', color: '#1a2742', margin: '0 0 2px' }
const lineMutedRow = { fontSize: '13px', color: '#7a7560', margin: '0 0 2px' }
const linePrice = { fontSize: '14px', color: '#0f1c33', margin: '4px 0 0', fontWeight: 600 }
const hr = { border: 'none', borderTop: '1px solid #e6e2d6', margin: '14px 0' }
const totalRow = { fontSize: '16px', color: '#0f1c33', margin: '0 0 4px' }
const fineprint = { fontSize: '12px', color: '#7a7560', margin: '0' }
const signoff = { fontSize: '14px', color: '#1a2742', margin: '20px 0 0' }
