import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customerName?: string
  serviceName?: string
  petName?: string
  requestedWhen?: string
  reason?: string
  reasonLabel?: string
  suggestionHeading?: string
  suggestionLines?: string[]
  sitterName?: string
}

const Email = ({
  customerName = 'there',
  serviceName = 'walk',
  petName = 'your dog',
  requestedWhen,
  reason,
  reasonLabel,
  suggestionHeading,
  suggestionLines,
  sitterName = 'Anneke',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your booking request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Booking update</Text>
        <Heading style={h1}>I can't take this one.</Heading>
        <Text style={text}>Hi {customerName},</Text>
        <Text style={text}>
          Thanks for the request — unfortunately I'm not able to accept your {serviceName.toLowerCase()}
          {petName ? ` for ${petName}` : ''}{requestedWhen ? ` (${requestedWhen})` : ''} this time
          {reasonLabel ? ` (${reasonLabel.toLowerCase()})` : ''}.
        </Text>
        {reason ? (
          <Section style={detailBox}>
            <Text style={detailLabel}>A note from {sitterName}</Text>
            <Text style={detailText}>{reason}</Text>
          </Section>
        ) : null}
        {suggestionHeading ? (
          <Section style={suggestionBox}>
            <Text style={suggestionHeader}>{suggestionHeading}</Text>
            {(suggestionLines ?? []).map((line, idx) => (
              <Text key={idx} style={suggestionItem}>{line}</Text>
            ))}
          </Section>
        ) : null}
        <Text style={text}>
          Just send another request that works for you and I'll do my best to make it happen.
        </Text>
        <Text style={footer}>— {sitterName}, Yo Dawg</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Update on your booking request',
  displayName: 'Booking declined',
  previewData: {
    customerName: 'Maya',
    serviceName: 'Group walk',
    petName: 'Biscuit',
    requestedWhen: 'Tue, Apr 28, 2026 · 1:00 PM',
    reasonLabel: 'Pack is full',
    reason: 'My midday group is full that day.',
    suggestionHeading: 'Could any of these times work?',
    suggestionLines: ['• Thu, Apr 30 — 9–10am', '• Fri, May 1 — 1–2pm'],
    sitterName: 'Anneke',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Epilogue, Arial, sans-serif', margin: '0', padding: '32px 12px' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '28px', borderRadius: '16px', border: '1px solid #d7ceb7', backgroundColor: '#fdfbf5' }
const eyebrow = { margin: '0 0 10px', color: '#965022', fontSize: '12px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase' as const }
const h1 = { margin: '0 0 16px', color: '#314b38', fontSize: '28px', lineHeight: '1.05', fontWeight: '700', fontFamily: 'Urbanist, Epilogue, Arial, sans-serif' }
const text = { margin: '0 0 14px', color: '#3b3730', fontSize: '15px', lineHeight: '1.65' }
const detailBox = { margin: '18px 0', padding: '14px 16px', borderRadius: '12px', border: '1px solid #d7ceb7', backgroundColor: '#f2ebdb' }
const detailLabel = { margin: '0 0 6px', color: '#6e675d', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const detailText = { margin: '0', color: '#314b38', fontSize: '14px', lineHeight: '1.5', fontWeight: '600', whiteSpace: 'pre-wrap' as const }
const suggestionBox = { margin: '18px 0', padding: '14px 16px', borderRadius: '12px', border: '1px solid #b8d4c4', backgroundColor: '#eaf3ec' }
const suggestionHeader = { margin: '0 0 8px', color: '#314b38', fontSize: '14px', fontWeight: '700' }
const suggestionItem = { margin: '0 0 4px', color: '#314b38', fontSize: '14px', lineHeight: '1.5' }
const footer = { margin: '24px 0 0', color: '#6e675d', fontSize: '13px', lineHeight: '1.5' }
