import type { ContributionStatus, CycleStatus, PaymentVerificationStatus } from '@/types';

/** MUI chip colors used across the admin contributions feature. */
export type ChipColor = 'default' | 'success' | 'warning' | 'info' | 'error';

/**
 * Contribution status → chip color. Mirrors the user-facing mapping so the
 * same status reads the same way on both sides of the app.
 */
export function contributionStatusColor(status: ContributionStatus): ChipColor {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

/** Payment verification status → chip color. */
export function paymentStatusColor(status: PaymentVerificationStatus): ChipColor {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

/** Cycle status → chip color (used by the cycle selector). */
export function cycleStatusColor(status: CycleStatus): ChipColor {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'UPCOMING':
      return 'info';
    case 'COMPLETED':
      return 'default';
    case 'CANCELLED':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Verify and reject are documented to fail with 400 unless the payment is
 * PENDING, so the actions are only offered in that state. The backend remains
 * the authority — this gate just avoids surfacing an action that cannot
 * succeed.
 */
export function canActOnPayment(status: PaymentVerificationStatus): boolean {
  return status === 'PENDING';
}

/**
 * mark-overdue is documented to fail with 400 when the cycle is COMPLETED or
 * CANCELLED, so the action is hidden for those states.
 */
export function canMarkOverdue(cycleStatus: CycleStatus): boolean {
  return cycleStatus !== 'COMPLETED' && cycleStatus !== 'CANCELLED';
}

/**
 * Contributions can be generated explicitly only while a cycle is ACTIVE.
 * Completed/cancelled cycles can still contain historical contributions.
 */
export function isContributionBearingCycle(status: CycleStatus): boolean {
  return status !== 'UPCOMING';
}
