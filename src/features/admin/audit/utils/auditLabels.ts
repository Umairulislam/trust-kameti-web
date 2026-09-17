import type { AuditAction } from '@/types';

export const AUDIT_LABELS: Record<AuditAction, string> = {
  COMMITTEE_CREATED: 'Committee created',
  COMMITTEE_UPDATED: 'Committee updated',
  COMMITTEE_STATUS_CHANGED: 'Committee status changed',
  MEMBER_INVITED: 'Member invited',
  MEMBER_JOINED: 'Member joined',
  MEMBER_REMOVED: 'Member removed',
  PAYMENT_RECEIPT_UPLOADED: 'Payment receipt uploaded',
  PAYMENT_VERIFIED: 'Payment verified',
  PAYMENT_REJECTED: 'Payment rejected',
  CONTRIBUTION_STATUS_CHANGED: 'Contribution status changed',
  LOTTERY_EXECUTED: 'Lottery executed',
  PAYOUT_CREATED: 'Payout created',
  PAYOUT_STATUS_CHANGED: 'Payout status changed',
};

export function auditLabel(action: AuditAction): string {
  return AUDIT_LABELS[action] ?? action;
}
