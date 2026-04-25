import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Yo Dawg Services'

interface RefundProps {
  customerName?: string
  invoiceNumber?: string
  refundedCents?: number
  reason?: string
}

const formatMoney = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`

const RefundIssuedEmail = ({
  customerName = 'there',
  invoiceNumber = '',
  refundedCents = 0,
  reason = '',
}: RefundProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Refund of {formatMoney(refundedCents)} processed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={banner}>
          <Heading style={h1}>Refund processed</Heading>
        </Section>

        <Text style={text}>
          Hi {customerName}, a refund of <strong>{formatMoney(refundedCents)}</strong> has been issued
          {invoiceNumber ? ` for invoice ${invoiceNumber}` : ''}. It should appear on your statement within 5–10 business days.
        </Text>

        {reason ? (
          <Section style={card}>
            <Text style={label}>Reason</Text>
            <Text style={value}>{reason}</Text>
          </Section>
        ) : null}

        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RefundIssuedEmail,
  subject: () => `Refund processed — ${SITE_NAME}`,
  displayName: 'Refund issued',
  previewData: {
    customerName: 'Sam',
    invoiceNumber: 'INV-2026-0001',
    refundedCents: 4000,
    reason: 'Cancelled within policy window',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const banner = { backgroundColor: '#5a4a8a', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#fdf6e9', margin: '0' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.55', margin: '0 0 18px' }
const card = { border: '1px solid #e6e2d6', borderRadius: '14px', padding: '18px 20px', backgroundColor: '#fdfbf5', marginBottom: '18px' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#7c7766', margin: '0 0 4px', fontWeight: 600 }
const value = { fontSize: '15px', color: '#0f1c33', margin: '0' }
const footer = { fontSize: '12px', color: '#7c7766', margin: '20px 0 0', textAlign: 'center' as const }
