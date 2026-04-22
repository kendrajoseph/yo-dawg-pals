import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { customerName?: string; serviceName?: string; petName?: string; scheduledStartAt?: string; groupLabel?: string; payUrl?: string }
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }) : 'TBD'
const Email = ({ customerName = 'there', serviceName = 'Group Walk', petName = 'your dog', scheduledStartAt, groupLabel = 'your matched group', payUrl = '#' }: Props) => (
  <Html lang="en"><Head /><Preview>Your group walk is ready for payment</Preview><Body style={main}><Container style={container}><Heading style={h1}>Your walk is matched.</Heading><Text style={text}>Hey {customerName}, {petName} is set for {serviceName.toLowerCase()} with {groupLabel}.</Text><Text style={text}>Exact time: {fmt(scheduledStartAt)}</Text><Button href={payUrl} style={button}>Pay now</Button></Container></Body></Html>
)
export const template = { component: Email, subject: 'Your group walk is ready to confirm', displayName: 'Group walk payment request', previewData: { customerName: 'Sam', petName: 'Biscuit', scheduledStartAt: '2026-04-25T15:00:00Z', groupLabel: 'the calm midday crew', payUrl: 'https://yodawg.ca/booking/test/checkout' } } satisfies TemplateEntry
const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px', border: '1px solid #e6e2d6', borderRadius: '14px', backgroundColor: '#fdfbf5' }
const h1 = { fontSize: '24px', color: '#0f1c33', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.6', margin: '0 0 12px' }
const button = { display: 'inline-block', padding: '12px 18px', backgroundColor: '#e85d3a', color: '#ffffff', textDecoration: 'none', borderRadius: '10px', fontWeight: '700' }
