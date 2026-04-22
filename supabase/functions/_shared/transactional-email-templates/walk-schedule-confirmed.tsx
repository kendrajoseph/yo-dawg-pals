import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { customerName?: string; serviceName?: string; petName?: string; scheduledStartAt?: string }
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }) : 'TBD'
const Email = ({ customerName = 'there', serviceName = 'Solo Walk', petName = 'your dog', scheduledStartAt }: Props) => (
  <Html lang="en"><Head /><Preview>Your walk time is confirmed</Preview><Body style={main}><Container style={container}><Heading style={h1}>Time confirmed.</Heading><Text style={text}>Hey {customerName}, your {serviceName.toLowerCase()} for {petName} is locked in.</Text><Text style={text}>Exact time: {fmt(scheduledStartAt)}</Text></Container></Body></Html>
)
export const template = { component: Email, subject: 'Your walk time is confirmed', displayName: 'Walk schedule confirmed', previewData: { customerName: 'Sam', serviceName: 'Solo Walk', petName: 'Biscuit', scheduledStartAt: '2026-04-25T16:00:00Z' } } satisfies TemplateEntry
const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px', border: '1px solid #e6e2d6', borderRadius: '14px', backgroundColor: '#fdfbf5' }
const h1 = { fontSize: '24px', color: '#0f1c33', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.6', margin: '0 0 12px' }
