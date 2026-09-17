import type { Payment, PaymentMethod, PaymentVerificationStatus } from '@/types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EASYPAISA: 'Easypaisa',
  JAZZCASH: 'JazzCash',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other manual payment',
};

export function paymentStatusColor(status: PaymentVerificationStatus): 'warning' | 'success' | 'error' {
  return status === 'VERIFIED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning';
}

export function paymentStatusLabel(payment: Payment): string {
  if (payment.status === 'PENDING') return payment.receipt ? 'Awaiting review' : 'Receipt needed';
  return payment.status === 'VERIFIED' ? 'Verified' : 'Rejected';
}

export function canUploadReceipt(payment: Payment, userId: string | undefined): boolean {
  return Boolean(userId) && payment.contribution?.member?.user?.id === userId &&
    payment.contribution?.member?.status === 'ACTIVE' && payment.status === 'PENDING' &&
    !payment.receipt && ['PENDING', 'OVERDUE'].includes(payment.contribution?.status ?? '') &&
    payment.contribution?.cycle?.status === 'ACTIVE';
}

export function paymentError(error: unknown, fallback = 'Unable to load payments. Please try again.'): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  if (status === 400) return 'The request was rejected. Check the reference and image, then refresh to check the contribution and cycle status.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have access to this payment or receipt.';
  if (status === 404) return 'The payment or receipt could not be found. Refresh and try again.';
  if (status === 409) return 'A pending claim or receipt already exists. Refresh to view the saved record.';
  if (status === 413) return 'The receipt must be 5 MiB or smaller.';
  return fallback;
}
