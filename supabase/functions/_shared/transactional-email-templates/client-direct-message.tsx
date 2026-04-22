import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customerName?: string
  subject?: string
  message?: string
  sitterName?: string
  bookingLabel?: string
  kindLabel?: string
}

const ClientDirectMessageEmail = ({
  customerName = 'there',
  subject = 'A quick update from Anneke',
  message = 'There is a new update waiting for you in your account.',
  sitterName = 'Anneke',
  bookingLabel,
  kindLabel = 'Client update',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>{kindLabel}</Text>
        <Heading style={h1}>{subject}</Heading>
        <Text style={text}>Hi {customerName},</Text>
        <Text style={text}>{message}</Text>
        {bookingLabel ? (
          <Section style={detailBox}>
            <Text style={detailLabel}>Related service</Text>
            <Text style={detailText}>{bookingLabel}</Text>
          </Section>
        ) : null}
        <Text style={footer}>— {sitterName}, Yo Dawg</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientDirectMessageEmail,
  subject: (data: Record<string, any>) => data.subject || 'A quick update from Anneke',
  displayName: 'Client direct message',
  previewData: {
    customerName: 'Maya',
    subject: 'Group walk timing update',
    message: 'Tomorrow’s walk window is shifting a little later because of the heat. I’ve updated the account notice with the new timing.',
    sitterName: 'Anneke',
    bookingLabel: 'Group Walk · Tue, Apr 28 at 1:00 PM',
    kindLabel: 'Service update',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Epilogue, Arial, sans-serif',
  margin: '0',
  padding: '32px 12px',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '28px 28px 24px',
  borderRadius: '16px',
  border: '1px solid #d7ceb7',
  backgroundColor: '#fdfbf5',
}

const eyebrow = {
  margin: '0 0 10px',
  color: '#965022',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
}

const h1 = {
  margin: '0 0 16px',
  color: '#314b38',
  fontSize: '28px',
  lineHeight: '1.05',
  fontWeight: '700',
  fontFamily: 'Urbanist, Epilogue, Arial, sans-serif',
}

const text = {
  margin: '0 0 14px',
  color: '#3b3730',
  fontSize: '15px',
  lineHeight: '1.65',
}

const detailBox = {
  margin: '18px 0 18px',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid #d7ceb7',
  backgroundColor: '#f2ebdb',
}

const detailLabel = {
  margin: '0 0 6px',
  color: '#6e675d',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
}

const detailText = {
  margin: '0',
  color: '#314b38',
  fontSize: '14px',
  lineHeight: '1.5',
  fontWeight: '600',
}

const footer = {
  margin: '24px 0 0',
  color: '#6e675d',
  fontSize: '13px',
  lineHeight: '1.5',
}