'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import type { Contribution, Payment } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { useCreatePaymentMutation } from '../api/paymentsApi';
import { paymentClaimSchema, type PaymentClaimFormData } from '../schemas/paymentClaimSchema';
import { PAYMENT_METHOD_LABELS, paymentError } from '../utils/paymentPresentation';
import { ReceiptUpload } from './ReceiptUpload';

interface PayContributionDialogProps {
  open: boolean;
  onClose: () => void;
  committeeId: string;
  contribution: Contribution;
  cycleNumber?: number;
  pendingPayment?: Payment;
  onBehalfOf?: string;
}

function PaymentClaimDialog({ onClose, committeeId, contribution, cycleNumber, pendingPayment, onBehalfOf }: Omit<PayContributionDialogProps, 'open'>) {
  const [createPayment, { isLoading }] = useCreatePaymentMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedPayment, setRecordedPayment] = useState<Payment | null>(null);
  // A list refresh can recover a saved claim after an interrupted creation response.
  const recordedPayment = pendingPayment?.receipt && pendingPayment.id === savedPayment?.id
    ? pendingPayment
    : savedPayment ?? pendingPayment;
  const [uploading, setUploading] = useState(false);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentClaimFormData>({
    resolver: zodResolver(paymentClaimSchema),
    defaultValues: { transactionReference: '', paymentMethod: 'EASYPAISA' },
  });
  const busy = isLoading || isSubmitting || uploading;
  const complete = Boolean(recordedPayment?.receipt);

  const onSubmit = async (data: PaymentClaimFormData) => {
    setServerError(null);
    try {
      const payment = await createPayment({ committeeId, contributionId: contribution.id, amount: Number(contribution.amount), ...data }).unwrap();
      setRecordedPayment(payment);
    } catch (err: unknown) {
      setServerError(paymentError(err, 'The claim could not be confirmed. Check the Payments tab before submitting again.'));
    }
  };

  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} maxWidth="sm" fullWidth aria-labelledby="payment-claim-title">
      <DialogTitle id="payment-claim-title">{onBehalfOf ? 'Record member payment' : 'Submit payment proof'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {onBehalfOf && <Alert severity="info">Recording on behalf of {onBehalfOf}. The claim remains attributed to this member and requires a receipt and a separate verification decision.</Alert>}
          <Stepper activeStep={complete ? 2 : recordedPayment ? 1 : 0} alternativeLabel>
            <Step><StepLabel>Record transfer</StepLabel></Step>
            <Step><StepLabel>Upload receipt</StepLabel></Step>
          </Stepper>
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="h5">{formatCurrency(contribution.amount)}</Typography>
            <Typography variant="body2" color="text.secondary">Cycle {cycleNumber ?? '—'} · Due {formatDate(contribution.dueDate)}</Typography>
          </Box>
          {!recordedPayment ? (
            <>
              <Alert severity="info">{onBehalfOf
                ? 'Enter the method and reference from the member’s completed manual transfer. This action records a claim; it does not transfer money or mark the contribution paid.'
                : 'First transfer the exact amount through Easypaisa, JazzCash, your bank or another manual channel. Confirm the receiving account with your committee admin. This app records your proof; it does not send money.'}</Alert>
              {serverError && <Alert severity="error">{serverError}</Alert>}
              <Stack component="form" id="payment-claim-form" onSubmit={handleSubmit(onSubmit)} noValidate spacing={2}>
                <Controller name="paymentMethod" control={control} render={({ field }) => (
                  <TextField {...field} select fullWidth label="Payment method" disabled={busy} error={Boolean(errors.paymentMethod)} helperText={errors.paymentMethod?.message}>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </TextField>
                )} />
                <TextField label="Transaction reference" placeholder="e.g. TRX-2026-1004" fullWidth autoComplete="off" disabled={busy}
                  error={Boolean(errors.transactionReference)} helperText={errors.transactionReference?.message ?? 'Enter the reference from your completed transfer (up to 200 characters).'}
                  {...register('transactionReference')} />
                <Typography variant="body2" color="text.secondary">Have the PNG or JPEG receipt ready (up to 5 MiB). The contribution stays unpaid until the transfer is verified.</Typography>
              </Stack>
            </>
          ) : complete ? (
            <Alert severity="success">Receipt uploaded. The claim is awaiting admin review. The contribution is marked as paid only after approval.</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Claim saved · Ref: {recordedPayment.transactionReference}</Typography>
              <ReceiptUpload committeeId={committeeId} paymentId={recordedPayment.id} onUploaded={setRecordedPayment} onBusyChange={setUploading} />
              <Typography variant="caption" color="text.secondary">You can also finish this upload later from the Payments tab. Do not create another claim for this transfer.</Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} color="inherit">{complete ? 'Done' : recordedPayment ? 'Finish later' : 'Cancel'}</Button>
        {!recordedPayment && <Button type="submit" form="payment-claim-form" disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}>{busy ? 'Saving claim…' : 'Save claim and continue'}</Button>}
      </DialogActions>
    </Dialog>
  );
}

export function PayContributionDialog({ open, ...props }: PayContributionDialogProps) {
  return open ? <PaymentClaimDialog key={props.contribution.id} {...props} /> : null;
}
