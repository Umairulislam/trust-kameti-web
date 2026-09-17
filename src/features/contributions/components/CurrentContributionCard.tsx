'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Typography,
} from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import type { Contribution, ContributionStatus, Payment } from '@/types';
import { formatCurrency, formatDate } from '@/utils';

interface CurrentContributionCardProps {
  contribution: Contribution;
  cycleNumber: number;
  /** The user's newest payment claim for this contribution, if any. */
  latestPayment?: Payment;
  paymentCheckPending?: boolean;
  onPay: () => void;
  onViewPayment: (paymentId: string) => void;
}

/** Maps contribution status to chip color. */
function contributionStatusColor(status: ContributionStatus): 'warning' | 'success' | 'error' {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'error';
    default:
      return 'warning';
  }
}

/**
 * Card showing the user's contribution for the current (active) cycle:
 * amount, due date, status, and the pay action. Reflects the backend-side
 * payment claim state (awaiting verification / rejected) without ever
 * treating a claim as a completed payment.
 */
export function CurrentContributionCard({
  contribution,
  cycleNumber,
  latestPayment,
  paymentCheckPending,
  onPay,
  onViewPayment,
}: CurrentContributionCardProps) {
  const isPaid = contribution.status === 'PAID';
  // A submitted claim is still awaiting the admin's verification.
  const awaitingVerification = !isPaid && latestPayment?.status === 'PENDING';
  const needsReceipt = awaitingVerification && !latestPayment?.receipt;
  const lastClaimRejected = !isPaid && latestPayment?.status === 'REJECTED';

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <PaymentsOutlinedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Current Contribution
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cycle {cycleNumber}
            </Typography>
          </Box>
        </Box>
        <Chip
          label={contribution.status}
          color={contributionStatusColor(contribution.status)}
          variant="outlined"
        />
      </Box>

      {/* Key facts */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Amount
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {formatCurrency(contribution.amount)}
          </Typography>
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EventOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Due Date
            </Typography>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {formatDate(contribution.dueDate)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Paid On
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {formatDate(contribution.paidAt)}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2.5 }} />

      {/* Action area */}
      {isPaid ? (
        <Alert
          severity="success"
          icon={<TaskAltOutlinedIcon fontSize="small" />}
          action={
            contribution.paymentId ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => onViewPayment(contribution.paymentId as string)}
              >
                View Payment
              </Button>
            ) : undefined
          }
        >
          Paid on {formatDate(contribution.paidAt)}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {awaitingVerification && (
            <Alert severity="info" sx={{ overflowWrap: 'anywhere' }}>
              Payment submitted on {formatDate(latestPayment?.paidAt)} — Ref:{' '}
              {latestPayment?.transactionReference}. {needsReceipt ? 'Upload your receipt to complete this claim.' : 'Receipt attached. Awaiting verification by the committee admin.'}
            </Alert>
          )}
          {lastClaimRejected && (
            <Alert severity="warning">
              Your last payment claim (Ref: {latestPayment?.transactionReference}) was
              rejected on {formatDate(latestPayment?.verifiedAt)}. Check with your admin,
              then submit a new claim and receipt below.
            </Alert>
          )}
          <Box>
            <Button
              onClick={() => awaitingVerification && latestPayment ? onViewPayment(latestPayment.id) : onPay()}
              disabled={paymentCheckPending}
              startIcon={awaitingVerification ? undefined : <PaymentsOutlinedIcon />}
            >
              {paymentCheckPending ? 'Checking payment status…' : needsReceipt ? 'Upload receipt' : awaitingVerification ? 'View payment claim' : 'Submit payment proof'}
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
