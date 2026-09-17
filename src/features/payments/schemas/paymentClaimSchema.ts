import { z } from 'zod';

/**
 * Form values for recording a payment claim.
 * The amount is fixed by the contribution (the backend only accepts an amount
 * matching the contribution amount). The user records their transfer method
 * and reference before attaching the receipt in a separate request.
 */
export const paymentClaimSchema = z.object({
  transactionReference: z
    .string()
    .trim()
    .min(1, 'Transaction reference is required')
    .max(200, 'Use no more than 200 characters'),
  paymentMethod: z.enum(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'OTHER']),
});

export type PaymentClaimFormData = z.infer<typeof paymentClaimSchema>;

export const receiptSchema = z.file({ error: 'Select a receipt image' })
  .min(1, 'The receipt file is empty')
  .max(5_242_880, 'The receipt must be 5 MiB or smaller')
  .mime(['image/png', 'image/jpeg'], 'Select a PNG or JPEG image');

export const receiptUploadSchema = z.object({ receipt: receiptSchema });
