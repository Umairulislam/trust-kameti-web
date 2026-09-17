'use client';

import { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import type { Cycle, Payment } from '@/types';
import { useAuth } from '@/features/auth';
import { formatCurrency, formatDateTime } from '@/utils';
import { useGetPaymentQuery } from '../api/paymentsApi';
import { PAYMENT_METHOD_LABELS, canUploadReceipt, paymentError, paymentStatusColor, paymentStatusLabel } from '../utils/paymentPresentation';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptPreview } from './ReceiptPreview';

interface PaymentDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  committeeId: string;
  paymentId: string | null;
  cycles: Cycle[];
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{value}</Typography>
    </Box>
  );
}

function statusHint(payment: Payment): string {
  if (payment.status === 'VERIFIED') return 'The admin has verified this transfer. See the contribution status below.';
  if (payment.status === 'REJECTED') return 'This claim was rejected. Check with your admin, then submit a new claim and receipt from Contributions if the contribution is still unpaid and its cycle is active.';
  return payment.receipt
    ? 'Receipt attached. The admin must check the receiving account before approving this claim.'
    : 'This claim needs a receipt before the admin can verify it. Your contribution remains unpaid.';
}

function PaymentDetails({ onClose, committeeId, paymentId, cycles }: Omit<PaymentDetailsDialogProps, 'open' | 'paymentId'> & { paymentId: string }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const { currentData: payment, isFetching, isError, error, refetch } = useGetPaymentQuery(
    { committeeId, id: paymentId }, { refetchOnMountOrArgChange: true },
  );
  const cycle = cycles.find((item) => item.id === payment?.contribution?.cycleId);
  const ownsPayment = Boolean(user?.id) && payment?.contribution?.member?.user?.id === user?.id;

  return (
    <Dialog open onClose={() => { if (!uploading) onClose(); }} maxWidth="sm" fullWidth aria-labelledby="payment-details-title">
      <DialogTitle id="payment-details-title">Payment details</DialogTitle>
      <DialogContent>
        {!payment && isFetching ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress aria-label="Loading payment" /></Box> : isError ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => refetch()}>Retry</Button>}>{paymentError(error)}</Alert>
        ) : payment ? (
          <Stack spacing={2}>
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{formatCurrency(payment.amount)}</Typography>
              <Chip label={paymentStatusLabel(payment)} color={paymentStatusColor(payment.status)} variant="outlined" />
            </Box>
            <Alert severity={payment.status === 'REJECTED' ? 'warning' : 'info'}>{statusHint(payment)}</Alert>
            {uploaded && <Alert severity="success">Receipt uploaded. Payment verification remains with your admin.</Alert>}
            <Box>
              <DetailRow label="Payment method" value={payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? 'Not recorded' : 'Not recorded'} />
              <DetailRow label="Reference" value={payment.transactionReference} />
              <DetailRow label="Claim recorded" value={formatDateTime(payment.paidAt)} />
              <DetailRow label="Admin decision" value={formatDateTime(payment.verifiedAt)} />
              <DetailRow label="Cycle" value={cycle ? `Cycle ${cycle.cycleNumber}` : '—'} />
              <DetailRow label="Contribution status" value={payment.contribution?.status ?? '—'} />
            </Box>
            <Divider />
            <Typography variant="subtitle1">Receipt</Typography>
            {payment.receipt ? (
              <>
                <Typography variant="caption" color="text.secondary">Uploaded {formatDateTime(payment.receipt.uploadedAt)} · {Math.ceil(payment.receipt.size / 1024)} KiB</Typography>
                {ownsPayment ? <ReceiptPreview key={payment.receipt.id} committeeId={committeeId} paymentId={payment.id} /> : <Alert severity="info">Receipt images are private to the paying member and committee creator.</Alert>}
              </>
            ) : canUploadReceipt(payment, user?.id) ? (
              <ReceiptUpload committeeId={committeeId} paymentId={payment.id} onBusyChange={setUploading} onUploaded={() => setUploaded(true)} />
            ) : <Alert severity="info">No receipt attached. Upload is available only for your pending, unpaid claim while its cycle and membership are active.</Alert>}
          </Stack>
        ) : <Alert severity="info">Payment details are unavailable.</Alert>}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={uploading || isFetching} onClick={() => refetch()}>Refresh status</Button>
        <Button disabled={uploading} onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function PaymentDetailsDialog({ open, paymentId, ...props }: PaymentDetailsDialogProps) {
  return open && paymentId ? <PaymentDetails key={`${props.committeeId}-${paymentId}`} paymentId={paymentId} {...props} /> : null;
}
