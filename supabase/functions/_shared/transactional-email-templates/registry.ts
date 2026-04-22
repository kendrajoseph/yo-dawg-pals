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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-paid-notification': bookingPaidNotification,
  'client-direct-message': clientDirectMessage,
  'group-walk-payment-request': groupWalkPaymentRequest,
  'walk-request-received': walkRequestReceived,
  'walk-schedule-confirmed': walkScheduleConfirmed,
}
