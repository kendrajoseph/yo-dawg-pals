/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingPaidNotification } from './booking-paid-notification.tsx'
import { template as clientDirectMessage } from './client-direct-message.tsx'
import { template as groupWalkPaymentRequest } from './group-walk-payment-request.tsx'
import { template as walkRequestReceived } from './walk-request-received.tsx'
import { template as walkScheduleConfirmed } from './walk-schedule-confirmed.tsx'
import { template as invoiceIssued } from './invoice-issued.tsx'
import { template as paymentReceipt } from './payment-receipt.tsx'
import { template as paymentReminder } from './payment-reminder.tsx'
import { template as refundIssued } from './refund-issued.tsx'
import { template as bookingDeclined } from './booking-declined.tsx'
import { NightlyScheduleDigestEmail } from './nightly-schedule-digest.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'nightly-schedule-digest': {
    component: NightlyScheduleDigestEmail,
    subject: (data: Record<string, any>) =>
      `Tomorrow's schedule — ${data.dateStr ?? 'tomorrow'}`,
    displayName: 'Nightly schedule digest (to AJ)',
    previewData: {
      dateStr: 'Tuesday, Nov 18',
      summary: '4 walks · 1 boarding',
      bookings: [
        { index: 1, time: '9:00 AM', serviceName: 'Solo Walk', petName: 'Moose' },
        { index: 2, time: '10:30 AM', serviceName: 'Group Walk', petName: 'Dexter' },
        { index: 3, time: '2:00 PM', serviceName: 'Boarding pickup', petName: 'Poppy' },
      ],
    },
  },
  'booking-paid-notification': bookingPaidNotification,
  'client-direct-message': clientDirectMessage,
  'group-walk-payment-request': groupWalkPaymentRequest,
  'walk-request-received': walkRequestReceived,
  'walk-schedule-confirmed': walkScheduleConfirmed,
  'invoice-issued': invoiceIssued,
  'payment-receipt': paymentReceipt,
  'payment-reminder': paymentReminder,
  'refund-issued': refundIssued,
  'booking-declined': bookingDeclined,
}
