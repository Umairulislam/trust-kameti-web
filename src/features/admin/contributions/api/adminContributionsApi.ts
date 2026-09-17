import { baseApi } from '@/api/baseApi';
import type { Contribution, Payment } from '@/types';
import type {
  GenerateContributionsParams,
  GenerateContributionsResponse,
  MarkOverdueParams,
  MarkOverdueResponse,
  PaymentActionParams,
  SendCommitteeNotificationInput,
  SendCommitteeNotificationResponse,
} from '../types';

/**
 * Admin contribution & payment endpoints (all committee-scoped).
 *
 * Read endpoints that already exist in `@/features/committees` and
 * `@/features/payments` (cycles, contributions list/summary, payments
 * list/detail) are reused verbatim by the UI rather than duplicated here.
 * This slice adds only the documented admin mutations plus the single
 * contribution-detail read that the user-facing slices do not expose.
 *
 * Every route comes from docs/api-documentation.md (Contributions, Payments,
 * Notifications sections). No endpoints, fields, or behaviours are invented;
 * the backend remains the source of truth for payment state, contribution
 * state, cycle totals, and audit records.
 */
export const adminContributionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateContributions: builder.mutation<GenerateContributionsResponse, GenerateContributionsParams>({
      query: ({ committeeId, cycleId }) => ({
        url: `/committees/${committeeId}/cycles/${cycleId}/contributions/generate`,
        method: 'POST',
      }),
      invalidatesTags: ['Contribution', 'Cycle', 'Report'],
    }),
    /**
     * Get one contribution with its paying member.
     * GET /committees/:committeeId/cycles/:cycleId/contributions/:id
     */
    getContribution: builder.query<
      Contribution,
      { committeeId: string; cycleId: string; id: string }
    >({
      query: ({ committeeId, cycleId, id }) =>
        `/committees/${committeeId}/cycles/${cycleId}/contributions/${id}`,
      providesTags: ['Contribution'],
    }),

    /**
     * Flip every past-due PENDING contribution of a cycle to OVERDUE.
     * POST /committees/:committeeId/cycles/:cycleId/contributions/mark-overdue
     *
     * The backend rejects the call with 400 when the cycle is COMPLETED or
     * CANCELLED, and records a CONTRIBUTION_STATUS_CHANGED audit entry when at
     * least one row changes — so both Contribution and Audit caches refresh.
     */
    markContributionsOverdue: builder.mutation<MarkOverdueResponse, MarkOverdueParams>({
      query: ({ committeeId, cycleId }) => ({
        url: `/committees/${committeeId}/cycles/${cycleId}/contributions/mark-overdue`,
        method: 'POST',
      }),
      invalidatesTags: ['Contribution', 'Audit'],
    }),

    /**
     * Verify a PENDING payment.
     * POST /committees/:committeeId/payments/:id/verify  (no request body)
     *
     * Documented side effects, all performed atomically by the backend:
     *   - payment.status → VERIFIED, verifiedAt stamped
     *   - contribution.status → PAID, paidAt stamped, paymentId linked
     *   - cycle.totalCollected incremented by the payment amount
     *   - PAYMENT_VERIFIED audit entry written
     * The backend attempts member notification after the transaction commits.
     * Every affected cache tag is invalidated so the UI always reflects the
     * authoritative backend state after the mutation resolves.
     */
    verifyPayment: builder.mutation<Payment, PaymentActionParams>({
      query: ({ committeeId, id }) => ({
        url: `/committees/${committeeId}/payments/${id}/verify`,
        method: 'POST',
      }),
      invalidatesTags: ['Payment', 'Contribution', 'Cycle', 'Audit', 'Notification', 'Report', 'Lottery'],
    }),

    /**
     * Reject a PENDING payment.
     * POST /committees/:committeeId/payments/:id/reject  (no request body)
     *
     * Documented side effects: payment.status → REJECTED, verifiedAt stamped,
     * PAYMENT_REJECTED audit entry written, then member notification attempted.
     * The contribution
     * is intentionally left untouched (remains PENDING/OVERDUE) so the member
     * can submit a new claim.
     */
    rejectPayment: builder.mutation<Payment, PaymentActionParams>({
      query: ({ committeeId, id }) => ({
        url: `/committees/${committeeId}/payments/${id}/reject`,
        method: 'POST',
      }),
      // Refresh financial reads on failures too: another admin session may have approved it.
      invalidatesTags: ['Payment', 'Contribution', 'Cycle', 'Audit', 'Notification', 'Report', 'Lottery'],
    }),

    /**
     * Broadcast a notification to every ACTIVE and INVITED member of the
     * committee plus the committee admin.
     * POST /committees/:committeeId/notifications
     *
     * Used for payment reminders. The documented endpoint does not accept a
     * recipient list, so reminders always reach the whole committee — the UI
     * states this explicitly rather than implying targeted delivery.
     */
    sendCommitteeNotification: builder.mutation<
      SendCommitteeNotificationResponse,
      SendCommitteeNotificationInput
    >({
      query: ({ committeeId, ...body }) => ({
        url: `/committees/${committeeId}/notifications`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGenerateContributionsMutation,
  useGetContributionQuery,
  useMarkContributionsOverdueMutation,
  useVerifyPaymentMutation,
  useRejectPaymentMutation,
  useSendCommitteeNotificationMutation,
} = adminContributionsApi;
