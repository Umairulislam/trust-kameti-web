'use client';

import { Box, Chip, List, ListItem, ListItemButton, Paper, Typography } from '@mui/material';
import type { Cycle, Payment } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { PAYMENT_METHOD_LABELS, paymentStatusColor, paymentStatusLabel } from '../utils/paymentPresentation';

interface PaymentsListProps {
  payments: Payment[];
  cycles: Cycle[];
  onSelect: (paymentId: string) => void;
}

export function PaymentsList({ payments, cycles, onSelect }: PaymentsListProps) {
  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>My payment claims ({payments.length})</Typography>
      <List disablePadding>
        {payments.map((payment) => {
          const cycle = cycles.find((item) => item.id === payment.contribution?.cycleId);
          return (
            <ListItem key={payment.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton onClick={() => onSelect(payment.id)} aria-label={`View payment ${payment.transactionReference}`} sx={{ p: 1.5, borderRadius: 1, display: 'block' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</Typography>
                  <Chip label={paymentStatusLabel(payment)} color={paymentStatusColor(payment.status)} size="small" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary">Cycle {cycle?.cycleNumber ?? '—'} · {payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? 'Method not recorded' : 'Method not recorded'}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Ref: {payment.transactionReference}</Typography>
                <Typography variant="caption" color="text.secondary">Claim recorded {formatDate(payment.paidAt)} · {payment.receipt ? 'Receipt attached' : 'No receipt attached'}</Typography>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}
