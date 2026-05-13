// ============================================================================
// FILE: supabase/functions/_shared/transactional-email-templates/nightly-schedule-digest.tsx
// ============================================================================
// Email backup of the nightly Telegram digest. Plain, readable, no buttons
// (email doesn't need them; this is the audit/backup channel).
// ============================================================================

import * as React from 'npm:react@18.3.1';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22';

interface BookingRow {
  index: number;
  time: string;
  serviceName: string;
  petName: string;
}

interface Props {
  dateStr: string;
  summary: string;
  bookings: BookingRow[];
}

export const NightlyScheduleDigestEmail = ({
  dateStr = 'Tomorrow',
  summary = '',
  bookings = [],
}: Props) => (
  <Html>
    <Head />
    <Preview>Tomorrow's schedule — {dateStr}</Preview>
    <Body style={body}>
      <Container style={container}>
        <Heading style={heading}>Tomorrow, {dateStr}</Heading>
        {summary && <Text style={summaryText}>{summary}</Text>}

        {bookings.length === 0 ? (
          <Section style={emptySection}>
            <Text style={emptyText}>Nothing scheduled. Enjoy the day off.</Text>
          </Section>
        ) : (
          <Section>
            {bookings.map((b) => (
              <div key={b.index} style={row}>
                <Text style={rowIndex}>{b.index}.</Text>
                <div style={rowBody}>
                  <Text style={rowTime}>{b.time}</Text>
                  <Text style={rowDetail}>
                    {b.serviceName} — {b.petName}
                  </Text>
                </div>
              </div>
            ))}
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Log pickups and drop-offs in Telegram as you go, or in your dashboard at yodawg.ca/sitter.
        </Text>
      </Container>
    </Body>
  </Html>
);

const body = {
  backgroundColor: '#f5f1e3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  border: '2px solid #2c2c2c',
};
const heading = { fontSize: '28px', fontWeight: 700, color: '#2c2c2c', margin: '0 0 8px' };
const summaryText = { fontSize: '15px', color: '#6b6b6b', margin: '0 0 24px' };
const emptySection = { padding: '24px 0', textAlign: 'center' as const };
const emptyText = { fontSize: '15px', color: '#6b6b6b' };
const row = {
  display: 'flex',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid #ececec',
};
const rowIndex = { fontSize: '15px', fontWeight: 700, color: '#2c2c2c', margin: 0, minWidth: '24px' };
const rowBody = { flex: 1 };
const rowTime = { fontSize: '15px', fontWeight: 600, color: '#2c2c2c', margin: 0 };
const rowDetail = { fontSize: '14px', color: '#6b6b6b', margin: '2px 0 0' };
const hr = { borderColor: '#ececec', margin: '24px 0 16px' };
const footer = { fontSize: '12px', color: '#9a9a9a', textAlign: 'center' as const };

export default NightlyScheduleDigestEmail;
