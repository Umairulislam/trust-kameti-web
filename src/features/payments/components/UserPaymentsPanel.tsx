'use client';

import { useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import type { PaymentVerificationStatus } from '@/types';
import { paymentError } from '../utils/paymentPresentation';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useAuth } from '@/features/auth';
import { useGetCyclesQuery } from '@/features/committees';
import { useGetPaymentsQuery } from '../api/paymentsApi';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';
import { PaymentsList } from './PaymentsList';

interface UserPaymentsPanelProps {
  committeeId: string;
}

/**
 * User-side payments panel for a committee.
 * Lists the current user's payment records with amount, status, transaction
 * reference, and payment date, and opens details on selection.
 */
export function UserPaymentsPanel({ committeeId }: UserPaymentsPanelProps) {
  const { user } = useAuth();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentVerificationStatus | 'ALL'>('ALL');

  const {
    currentData: payments,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetPaymentsQuery({ committeeId }, { refetchOnMountOrArgChange: true });

  const {
    data: cyclesData,
    isLoading: cyclesLoading,
    isError: cyclesError,
    refetch: refetchCycles,
  } = useGetCyclesQuery({ committeeId, limit: 50 });

  // The endpoint lists committee-wide payments; show only the current user's.
  const myPayments = (payments ?? []).filter(
    (payment) => Boolean(user?.id) && payment.contribution?.member?.user?.id === user?.id,
  );
  const filteredPayments = myPayments.filter((payment) => status === 'ALL' || payment.status === status);

  if (isLoading || cyclesLoading) {
    return (
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          My Payments
        </Typography>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'action.hover' }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ height: 14, bgcolor: 'action.hover', borderRadius: 1, mb: 0.5, width: '60%' }} />
              <Box sx={{ height: 12, bgcolor: 'action.hover', borderRadius: 1, width: '40%' }} />
            </Box>
          </Box>
        ))}
      </Paper>
    );
  }

  if (isError) {
    return <Alert severity="error" action={<Button color="inherit" onClick={() => refetch()}>Retry</Button>}>{paymentError(error)}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">Transfer money manually, then submit your reference and receipt from Contributions. Claims and receipts do not settle your dues until the admin approves them.</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select size="small" label="Payment status" value={status} onChange={(event) => setStatus(event.target.value as PaymentVerificationStatus | 'ALL')} sx={{ minWidth: 200 }}>
          <MenuItem value="ALL">All claims</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="VERIFIED">Verified</MenuItem>
          <MenuItem value="REJECTED">Rejected</MenuItem>
        </TextField>
        <Button variant="outlined" disabled={isFetching} onClick={() => refetch()}>{isFetching ? 'Refreshing…' : 'Refresh payments'}</Button>
      </Stack>
      {cyclesError && <Alert severity="warning" action={<Button color="inherit" onClick={() => refetchCycles()}>Retry</Button>}>Cycle numbers could not be loaded. Your payment records are still available.</Alert>}
      {filteredPayments.length === 0 ? (
        <Paper sx={{ py: 8, textAlign: 'center' }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {myPayments.length === 0 ? 'No payment claims yet' : 'No claims match this status'}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {myPayments.length === 0 ? 'After transferring money, open Contributions to submit your payment proof.' : 'Choose another status to view your claims.'}
          </Typography>
        </Paper>
      ) : (
        <PaymentsList
          payments={filteredPayments}
          cycles={cyclesData?.data ?? []}
          onSelect={setSelectedPaymentId}
        />
      )}

      <PaymentDetailsDialog
        open={Boolean(selectedPaymentId)}
        onClose={() => setSelectedPaymentId(null)}
        committeeId={committeeId}
        paymentId={selectedPaymentId}
        cycles={cyclesData?.data ?? []}
      />
    </Stack>
  );
}
