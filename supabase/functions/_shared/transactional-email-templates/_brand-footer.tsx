import * as React from 'npm:react@18.3.1'
import { Hr, Link, Section, Text } from 'npm:@react-email/components@0.0.22'

// Shared YoDawg branding block rendered at the bottom of every outgoing
// invoice, receipt, and reminder. Do NOT add unsubscribe links here — the
// transactional email pipeline appends a compliant unsubscribe footer
// automatically.

export const BRAND = {
  name: 'Yo Dawg',
  tagline: 'Trusted dog care in your neighbourhood',
  email: 'hello@yodawg.ca',
  phone: '',
  website: 'https://yodawg.ca',
  websiteDisplay: 'yodawg.ca',
}

export const BrandFooter = () => (
  <Section style={wrap}>
    <Hr style={hr} />
    <Text style={brand}>{BRAND.name}</Text>
    <Text style={tag}>{BRAND.tagline}</Text>
    <Text style={line}>
      <Link href={`mailto:${BRAND.email}`} style={link}>{BRAND.email}</Link>
      {BRAND.phone ? <> · {BRAND.phone}</> : null}
      {' · '}
      <Link href={BRAND.website} style={link}>{BRAND.websiteDisplay}</Link>
    </Text>
  </Section>
)

const wrap = { marginTop: '28px', textAlign: 'center' as const }
const hr = { borderColor: '#ece7d6', margin: '0 0 16px' }
const brand = { fontSize: '14px', fontWeight: 700, color: '#0f1c33', margin: '0 0 2px', letterSpacing: '0.02em' }
const tag = { fontSize: '12px', color: '#7c7766', margin: '0 0 8px', fontStyle: 'italic' as const }
const line = { fontSize: '12px', color: '#55607a', margin: '0' }
const link = { color: '#0f1c33', textDecoration: 'underline' }
