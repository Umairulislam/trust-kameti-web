'use client';

import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { Payment } from '@/types';
import { useUploadPaymentReceiptMutation } from '../api/paymentsApi';
import { receiptUploadSchema } from '../schemas/paymentClaimSchema';
import { paymentError } from '../utils/paymentPresentation';

function SelectedReceiptPreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <Box component="img" ref={imageRef} alt="Selected payment receipt" sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 1 }} />;
}

export function ReceiptUpload({ committeeId, paymentId, onUploaded, onBusyChange }: {
  committeeId: string;
  paymentId: string;
  onUploaded?: (payment: Payment) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [upload, { isLoading }] = useUploadPaymentReceiptMutation();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ receipt: File }>({
    resolver: zodResolver(receiptUploadSchema),
  });
  const file = useWatch({ control, name: 'receipt' });
  const busy = isLoading || isSubmitting;

  const submit = async ({ receipt }: { receipt: File }) => {
    setError(null);
    onBusyChange(true);
    try {
      const payment = await upload({ committeeId, id: paymentId, receipt }).unwrap();
      onUploaded?.(payment);
    } catch (err: unknown) {
      setError(paymentError(err, 'The claim is saved, but the receipt upload could not be confirmed. Retry the upload here or reopen this claim from the Payments tab.'));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <Stack component="form" onSubmit={handleSubmit(submit)} noValidate spacing={2}>
      <Alert severity="info">Upload a clear receipt showing the amount and transaction reference. Once attached, it cannot be replaced or deleted.</Alert>
      <Controller name="receipt" control={control} render={({ field }) => (
        <Box>
          <Typography component="label" htmlFor={`receipt-${paymentId}`} variant="body2" sx={{ display: 'block', mb: 1 }}>Receipt image</Typography>
          <Box component="input" id={`receipt-${paymentId}`} type="file" accept="image/png,image/jpeg" name={field.name} ref={field.ref} onBlur={field.onBlur}
            disabled={busy} aria-invalid={Boolean(errors.receipt)} aria-describedby={`receipt-help-${paymentId}`}
            onChange={(event) => { field.onChange(event.target.files?.[0]); setError(null); }} sx={{ maxWidth: '100%' }} />
          <Typography id={`receipt-help-${paymentId}`} variant="caption" color={errors.receipt ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 1 }}>
            {errors.receipt?.message ?? 'PNG or JPEG only, up to 5 MiB.'}
          </Typography>
        </Box>
      )} />
      {file && !errors.receipt && file.size > 0 && file.size <= 5_242_880 && ['image/png', 'image/jpeg'].includes(file.type) && <SelectedReceiptPreview key={`${file.name}-${file.lastModified}`} file={file} />}
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}>
        {busy ? 'Uploading receipt…' : 'Upload receipt'}
      </Button>
    </Stack>
  );
}
