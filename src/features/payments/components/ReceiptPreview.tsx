'use client';

import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useGetPaymentReceiptQuery } from '../api/paymentsApi';
import { paymentError } from '../utils/paymentPresentation';

/** The caller gates access; the receipt endpoint enforces ownership/creator permissions. */
export function ReceiptPreview({ committeeId, paymentId }: { committeeId: string; paymentId: string }) {
  const { data: url, isLoading, isError, error, refetch } = useGetPaymentReceiptQuery({ committeeId, id: paymentId });
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress aria-label="Loading receipt" /></Box>;
  if (isError) return (
    <Alert severity="error" action={<Button color="inherit" onClick={() => refetch()}>Retry</Button>}>
      {paymentError(error, 'Unable to load the receipt. Please try again.')}
    </Alert>
  );
  return url ? (
    <Stack spacing={1}>
      <Box component="img" src={url} alt="Uploaded payment receipt" sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 1 }} />
      <Button component="a" href={url} target="_blank" rel="noopener noreferrer" variant="outlined">Open full-size receipt</Button>
    </Stack>
  ) : null;
}
