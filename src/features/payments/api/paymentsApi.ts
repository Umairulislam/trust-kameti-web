import { baseApi } from '@/api/baseApi';
import type { PaginatedResponse, Payment, PaymentMethod, PaymentVerificationStatus } from '@/types';

/** Request body for recording a payment claim. */
interface CreatePaymentRequest {
  contributionId: string;
  amount: number;
  transactionReference: string;
  paymentMethod?: PaymentMethod;
}

/** Params for the create payment mutation. */
interface CreatePaymentArgs extends CreatePaymentRequest {
  committeeId: string;
}

/** Params for the payments list query. */
interface GetPaymentsParams {
  committeeId: string;
  status?: PaymentVerificationStatus;
}

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Record a payment claim for a contribution.
     * The payment starts as PENDING — it only becomes VERIFIED (and the
     * contribution PAID) after the committee admin verifies it, so the
     * backend response is always the source of truth for the status.
     * POST /committees/:committeeId/payments
     */
    createPayment: builder.mutation<Payment, CreatePaymentArgs>({
      query: ({ committeeId, ...body }) => ({
        url: `/committees/${committeeId}/payments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Payment'],
    }),

    uploadPaymentReceipt: builder.mutation<Payment, { committeeId: string; id: string; receipt: File }>({
      query: ({ committeeId, id, receipt }) => {
        const body = new FormData();
        body.append('receipt', receipt);
        return { url: `/committees/${committeeId}/payments/${id}/receipt`, method: 'POST', body };
      },
      invalidatesTags: ['Payment', 'Audit'],
    }),

    // Keep private binary data out of Redux. The cache owns and releases the preview URL.
    getPaymentReceipt: builder.query<string, { committeeId: string; id: string }>({
      query: ({ committeeId, id }) => ({
        url: `/committees/${committeeId}/payments/${id}/receipt`,
        cache: 'no-store',
        responseHandler: async (response) => {
          if (!response.ok) return null;
          const blob = await response.blob();
          if (!['image/png', 'image/jpeg'].includes(blob.type)) throw new Error('Unexpected receipt format');
          return URL.createObjectURL(blob);
        },
      }),
      keepUnusedDataFor: 0,
      async onQueryStarted(_args, { queryFulfilled, getCacheEntry, requestId }) {
        try {
          const { data } = await queryFulfilled;
          if (getCacheEntry().requestId !== requestId) URL.revokeObjectURL(data);
        } catch { /* No preview was created. */ }
      },
      async onCacheEntryAdded(_args, { cacheDataLoaded, cacheEntryRemoved }) {
        try {
          const { data } = await cacheDataLoaded;
          await cacheEntryRemoved;
          URL.revokeObjectURL(data);
        } catch { /* The preview was closed before loading completed. */ }
      },
    }),

    /**
     * List all of a committee's payments, newest first.
     * GET /committees/:committeeId/payments (paginated — pages are fetched
     * sequentially and merged client-side so the user's own payments can be
     * filtered from the committee-wide list).
     */
    getPayments: builder.query<Payment[], GetPaymentsParams>({
      async queryFn({ committeeId, status }, _queryApi, _extraOptions, baseQuery) {
        const limit = 100;
        const payments: Payment[] = [];
        let page = 1;
        let total = Number.POSITIVE_INFINITY;

        while (payments.length < total) {
          const result = await baseQuery({
            url: `/committees/${committeeId}/payments`,
            params: { page, limit, ...(status ? { status } : {}) },
          });
          if (result.error) {
            return { error: result.error };
          }
          const body = result.data as PaginatedResponse<Payment>;
          payments.push(...body.data);
          total = body.total;
          if (body.data.length === 0) break;
          page += 1;
        }

        return { data: payments };
      },
      providesTags: ['Payment'],
    }),

    /**
     * Get a single payment.
     * GET /committees/:committeeId/payments/:id
     */
    getPayment: builder.query<Payment, { committeeId: string; id: string }>({
      query: ({ committeeId, id }) => `/committees/${committeeId}/payments/${id}`,
      providesTags: ['Payment'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // An admin may have decided the claim in another session.
          if (data.status !== 'PENDING') {
            dispatch(baseApi.util.invalidateTags(['Contribution', 'Cycle']));
          }
        } catch { /* Keep the last authoritative financial state on read failure. */ }
      },
    }),
  }),
});

export const {
  useCreatePaymentMutation,
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useUploadPaymentReceiptMutation,
  useGetPaymentReceiptQuery,
} = paymentsApi;
