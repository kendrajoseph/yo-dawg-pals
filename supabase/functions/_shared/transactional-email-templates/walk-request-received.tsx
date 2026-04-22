import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { customerName?: string; serviceName?: string; petName?: string }

const Email = ({ customerName = 'there', serviceName = 'your walk request', petName = 'your dog' }: Props) => (
  <Html lang="en"><Head /><Preview>We got your {serviceName.toLowerCase()} request</Preview><Body style={main}><Container style={container}><Heading style={h1}>Request received.</Heading><Text style={text}>Hey {customerName}, we’ve got your {serviceName.toLowerCase()} request for {petName}.</Text><Text style={text}>Anneke will review the fit, lock in the exact timing, and update your booking as soon as it’s ready.</Text></Container></Body></Html>
)

export const template = { component: Email, subject: 'Your walk request is in', displayName: 'Walk request received', previewData: { customerName: 'Sam', serviceName: 'Group Walk', petName: 'Biscuit' } } satisfies TemplateEntry
const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px', border: '1px solid #e6e2d6', borderRadius: '14px', backgroundColor: '#fdfbf5' }
const h1 = { fontSize: '24px', color: '#0f1c33', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a2742', lineHeight: '1.6', margin: '0 0 12px' }
