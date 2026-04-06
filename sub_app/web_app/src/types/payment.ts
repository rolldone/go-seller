export type PaymentStatus =
  | 'pending'
  | 'pending_verification'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export const PaymentStatuses: PaymentStatus[] = [
  'pending',
  'pending_verification',
  'succeeded',
  'failed',
  'cancelled',
  'rejected',
];
