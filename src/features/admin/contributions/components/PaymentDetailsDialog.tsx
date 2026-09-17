'use client';

import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Stack, Typography,
} from '@mui/material';
import type { Cycle } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils';
import { ReceiptPreview, ReceiptUpload, useGetPaymentQuery } from '@/features/payments';
import { PAYMENT_METHOD_LABELS, paymentError, paymentStatusLabel } from '@/features/payments/utils/paymentPresentation';
import { useRejectPaymentMutation, useVerifyPaymentMutation } from '../api/adminContributionsApi';
import { canActOnPayment, paymentStatusColor, contributionStatusColor } from '../utils/statusFlow';
import { adminPaymentError, canAttachPaymentReceipt, paymentVerificationIssue } from '../utils/paymentActions';
import { ConfirmDialog } from './ConfirmDialog';

interface PaymentDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  committeeId: string;
  paymentId: string | null;
  cycles: Cycle[];
  canManage: boolean;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{value}</Typography>
    </Box>
  );
}

function PaymentReview({ onClose, committeeId, paymentId, cycles, canManage }: Omit<PaymentDetailsDialogProps, 'open' | 'paymentId'> & { paymentId: string }) {
  const [decision, setDecision] = useState<'verify' | 'reject' | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = useRef(false);
  const [verifyPayment] = useVerifyPaymentMutation();
  const [rejectPayment] = useRejectPaymentMutation();
  const { currentData: payment, isFetching, isError, error, refetch } = useGetPaymentQuery(
    { committeeId, id: paymentId }, { refetchOnMountOrArgChange: true },
  );
  const busy = deciding || uploading;
  const actionable = Boolean(canManage && payment && !isError && canActOnPayment(payment.status));
  const verificationIssue = payment ? paymentVerificationIssue(payment) : 'Load the payment before reviewing it.';
  const cycle = cycles.find((item) => item.id === payment?.contribution?.cycleId);

  const decide = async () => {
    if (locked.current || busy || isFetching || !actionable || !decision || (decision === 'verify' && (!accountChecked || verificationIssue))) return;
    locked.current = true;
    setDeciding(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      // Recheck the selected claim immediately before submitting a decision.
      const latest = await refetch().unwrap();
      const issue = decision === 'verify' ? paymentVerificationIssue(latest)
        : canActOnPayment(latest.status) ? null : 'This claim has already been decided. Refresh to see its current status.';
      if (issue) {
        setActionError(issue);
        return;
      }
      const request = { committeeId, id: paymentId };
      const result = await (decision === 'verify' ? verifyPayment(request) : rejectPayment(request)).unwrap();
      setSuccessMessage(result.status === 'VERIFIED'
        ? 'Payment verified. The backend has recorded the approval; the contribution and totals are being refreshed.'
        : result.status === 'REJECTED'
          ? 'Claim rejected. Its receipt is retained, and the member can submit a new claim if still eligible.'
          : 'The server returned a pending claim. Refresh and check its status.');
      setDecision(null);
      setAccountChecked(false);
    } catch (err: unknown) {
      setActionError(adminPaymentError(err, 'review'));
    } finally {
      locked.current = false;
      setDeciding(false);
    }
  };

  return (
    <>
      <Dialog open onClose={() => { if (!busy) onClose(); }} maxWidth="sm" fullWidth aria-labelledby="admin-payment-title">
        <DialogTitle id="admin-payment-title">Review payment claim</DialogTitle>
        <DialogContent>
          {isError ? (
            <Alert severity="error" action={<Button color="inherit" onClick={() => refetch()}>Retry</Button>}>{paymentError(error)}</Alert>
          ) : !payment ? (
            <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress aria-label="Loading payment details" /></Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="h6">{payment.contribution?.member?.user?.name ?? 'Member not recorded'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{payment.contribution?.member?.user?.email}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Chip label={paymentStatusLabel(payment)} color={paymentStatusColor(payment.status)} size="small" />
                  {payment.contribution && <Chip label={`Contribution ${payment.contribution.status}`} size="small" variant="outlined" color={contributionStatusColor(payment.contribution.status)} />}
                </Stack>
              </Box>
              <Box>
                <Detail label="Claim amount" value={formatCurrency(payment.amount)} />
                <Detail label="Contribution amount" value={payment.contribution ? formatCurrency(payment.contribution.amount) : 'Not recorded'} />
                <Detail label="Payment method" value={payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? 'Not recorded' : 'Not recorded'} />
                <Detail label="Reference" value={payment.transactionReference} />
                <Detail label="Cycle" value={cycle ? `Cycle ${cycle.cycleNumber}` : 'Not recorded'} />
                <Detail label="Claim recorded" value={formatDateTime(payment.paidAt)} />
                <Detail label="Admin decision" value={formatDateTime(payment.verifiedAt)} />
              </Box>
              <Typography variant="caption" color="text.secondary">The claim timestamp is not confirmation that money reached the receiving account.</Typography>
              {successMessage && <Alert severity="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}
              {!canManage && <Alert severity="info">Only the committee creator can access receipts and manage these claims.</Alert>}
              <Divider />
              <Typography variant="subtitle1">Payment receipt</Typography>
              {canManage && payment.receipt ? (
                <>
                  <Typography variant="caption" color="text.secondary">Uploaded {formatDateTime(payment.receipt.uploadedAt)} · {Math.ceil(payment.receipt.size / 1024)} KiB</Typography>
                  <ReceiptPreview key={payment.receipt.id} committeeId={committeeId} paymentId={paymentId} />
                </>
              ) : canManage && canAttachPaymentReceipt(payment) ? (
                <ReceiptUpload committeeId={committeeId} paymentId={paymentId} onBusyChange={setUploading}
                  onUploaded={() => setSuccessMessage('Receipt attached. Check the receiving account before verifying this claim.')} />
              ) : <Typography variant="body2" color="text.secondary">{payment.receipt ? 'Receipt access is restricted.' : 'No receipt attached. Upload requires a pending claim, unpaid contribution and active cycle.'}</Typography>}
              {actionable && verificationIssue && <Alert severity="warning">{verificationIssue} You can still reject a pending claim, including one without a receipt.</Alert>}
              {payment.status === 'REJECTED' && <Alert severity="info">The old claim and receipt cannot be replaced. Record a new claim from Contributions if the contribution remains unpaid and its cycle is active.</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => refetch()} disabled={busy || isFetching} variant="outlined">Refresh status</Button>
          <Button onClick={onClose} disabled={busy} color="inherit">Close</Button>
          {actionable && <>
            <Button color="error" disabled={busy || isFetching} onClick={() => { setActionError(null); setDecision('reject'); }}>Reject</Button>
            <Button color="success" disabled={busy || isFetching || Boolean(verificationIssue)} onClick={() => { setActionError(null); setAccountChecked(false); setDecision('verify'); }}>Verify</Button>
          </>}
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={decision !== null} title={decision === 'verify' ? 'Verify payment' : 'Reject payment claim'}
        confirmLabel={decision === 'verify' ? 'Verify payment' : 'Reject claim'} confirmColor={decision === 'verify' ? 'success' : 'error'}
        loading={deciding} confirmDisabled={!actionable || isFetching || uploading || (decision === 'verify' && (!accountChecked || Boolean(verificationIssue)))}
        errorMessage={actionError} onConfirm={decide} onClose={() => { setDecision(null); setAccountChecked(false); }}>
        {decision === 'verify' ? (
          <>
            <Typography component="span">Check the receiving Easypaisa, JazzCash or bank account history. A receipt image alone does not prove the transfer arrived.</Typography>
            <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={accountChecked} disabled={deciding} onChange={(_, checked) => setAccountChecked(checked)} />}
              label="I checked the receiving account and matched the transaction reference and exact amount." />
          </>
        ) : 'Reject this pending claim? Its receipt and decision are retained. Rejection does not credit the contribution or refund money.'}
      </ConfirmDialog>
    </>
  );
}

export function PaymentDetailsDialog({ open, paymentId, ...props }: PaymentDetailsDialogProps) {
  return open && paymentId ? <PaymentReview key={`${props.committeeId}-${paymentId}`} paymentId={paymentId} {...props} /> : null;
}
