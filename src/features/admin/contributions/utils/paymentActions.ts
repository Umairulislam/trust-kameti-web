import type { Contribution, CycleStatus, Payment, User } from '@/types';

/** Presentation guards only. Every action is authorised and validated by the backend. */
export function canManageCommitteePayments(user: Pick<User, 'id' | 'role'> | null, creatorId: string): boolean {
  return user?.role === 'ADMIN' && user.id === creatorId;
}

export function canGenerateContributions(status: CycleStatus, memberCount: number | undefined): boolean {
  return status === 'ACTIVE' && memberCount === 0;
}

export function canRecordPayment(contribution: Contribution, status: CycleStatus): boolean {
  return status === 'ACTIVE' && ['PENDING', 'OVERDUE'].includes(contribution.status);
}

export function canAttachPaymentReceipt(payment: Payment): boolean {
  return payment.status === 'PENDING' && !payment.receipt &&
    payment.contribution?.cycle?.status === 'ACTIVE' &&
    ['PENDING', 'OVERDUE'].includes(payment.contribution?.status ?? '');
}

export function paymentVerificationIssue(payment: Payment): string | null {
  if (payment.status !== 'PENDING') return 'Only pending claims can be verified.';
  if (!payment.receipt) return 'Attach a receipt before verifying this claim.';
  if (payment.contribution?.cycle?.status !== 'ACTIVE') return 'Verification requires an active cycle.';
  if (!['PENDING', 'OVERDUE'].includes(payment.contribution.status)) return 'This contribution is no longer unpaid.';
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(payment.contribution.amount)) {
    return 'The claim amount does not match the contribution amount. Check the records before proceeding.';
  }
  return null;
}

export function adminPaymentError(error: unknown, operation: 'generate' | 'review'): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'Only the authorised committee creator can perform this action.';
  if (status === 404) return 'The committee, cycle or payment could not be found. Refresh the records.';
  if (status === 409) return operation === 'generate'
    ? 'Contributions already exist for this cycle. Refresh the list; do not generate them again.'
    : 'This payment or contribution has already changed. Refresh to see the saved decision.';
  if (status === 400) return operation === 'generate'
    ? 'Contributions could not be generated. The cycle must be active and the committee must have active members.'
    : 'The action was rejected. Refresh and check the claim status, receipt, amount and active cycle.';
  return 'The action could not be confirmed. Refresh the records before trying again.';
}
