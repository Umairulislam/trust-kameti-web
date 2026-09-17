/**
 * Admin contribution & payment management types.
 *
 * Contribution and payment record shapes already live in `@/types` and are
 * reused verbatim. This module only adds the admin-specific request/response
 * shapes for the documented mutations:
 *   POST /committees/:cid/cycles/:cycleId/contributions/generate
 *   POST /committees/:cid/cycles/:cycleId/contributions/mark-overdue
 *   POST /committees/:cid/payments/:id/verify
 *   POST /committees/:cid/payments/:id/reject
 *   POST /committees/:cid/notifications  (used for payment reminders)
 *
 * Field names come straight from docs/api-documentation.md — nothing invented.
 */
import type { Contribution, NotificationType } from '@/types';

export interface GenerateContributionsParams {
  committeeId: string;
  cycleId: string;
}

export interface GenerateContributionsResponse {
  generated: number;
  contributions: Omit<Contribution, 'member'>[];
}

/** Response from POST /committees/:cid/cycles/:cycleId/contributions/mark-overdue. */
export interface MarkOverdueResponse {
  /** Number of PENDING contributions flipped to OVERDUE by the backend. */
  marked: number;
}

/** Args for POST /committees/:cid/cycles/:cycleId/contributions/mark-overdue. */
export interface MarkOverdueParams {
  committeeId: string;
  cycleId: string;
}

/** Args for POST /committees/:cid/payments/:id/verify and .../reject. */
export interface PaymentActionParams {
  committeeId: string;
  id: string;
}

/**
 * Body for POST /committees/:cid/notifications.
 *
 * The documented endpoint broadcasts to every ACTIVE and INVITED member of the
 * committee plus the committee admin — it does not accept a recipient list, so
 * reminders sent through it always reach the whole committee.
 */
export interface SendCommitteeNotificationInput {
  committeeId: string;
  /** Optional; defaults to GENERAL on the backend. */
  type?: NotificationType;
  title: string;
  message: string;
}

/** Response from POST /committees/:cid/notifications. */
export interface SendCommitteeNotificationResponse {
  /** Number of recipients the backend actually delivered to. */
  sent: number;
}
