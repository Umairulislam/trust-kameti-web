'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import type { Cycle, PaymentVerificationStatus } from '@/types';
import { formatCurrency, formatDateTime, getInitials } from '@/utils';
import { useGetPaymentsQuery } from '@/features/payments';
import { PAYMENT_METHOD_LABELS, paymentError, paymentStatusLabel } from '@/features/payments/utils/paymentPresentation';
import {
  contributionStatusColor,
  paymentStatusColor,
} from '../utils/statusFlow';
import { cycleLabel } from './CycleSelector';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';

/** Payment status filter options — "ALL" plus every documented status. */
const STATUS_FILTERS: Array<PaymentVerificationStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'VERIFIED',
  'REJECTED',
];

interface PaymentsTabProps {
  canManage: boolean;
  committeeId: string;
  /** Committee cycles, used only to label which cycle each payment belongs to. */
  cycles: Cycle[];
}

function cycleNameFor(cycles: Cycle[], cycleId: string | undefined): string {
  if (!cycleId) return '—';
  const cycle = cycles.find((item) => item.id === cycleId);
  return cycle ? cycleLabel(cycle) : '—';
}

/**
 * Committee-wide payment history for GET /committees/:committeeId/payments.
 *
 * The documented endpoint spans every cycle of the committee (newest first) and
 * supports a server-side `status` filter; member/reference search is applied
 * client-side. Verification and rejection happen in the details dialog through
 * the documented POST .../verify and POST .../reject endpoints.
 */
export function PaymentsTab({ committeeId, cycles, canManage }: PaymentsTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentVerificationStatus | 'ALL'>('ALL');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [receiptFilter, setReceiptFilter] = useState<'ALL' | 'ATTACHED' | 'MISSING'>('ALL');

  const { currentData: data, isLoading, isFetching, isError, error, refetch } = useGetPaymentsQuery({
    committeeId,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  }, { refetchOnMountOrArgChange: true });

  const payments = useMemo(() => data ?? [], [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) =>
      (receiptFilter === 'ALL' || (receiptFilter === 'ATTACHED' ? Boolean(payment.receipt) : !payment.receipt)) &&
      `${payment.contribution?.member?.user?.name ?? ''} ${
        payment.contribution?.member?.user?.email ?? ''
      } ${payment.transactionReference}`
        .toLowerCase()
        .includes(term),
    );
  }, [payments, search, receiptFilter]);

  const filtersActive = statusFilter !== 'ALL' || search.trim() !== '' || receiptFilter !== 'ALL';
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setReceiptFilter('ALL');
  };

  const pendingCount = useMemo(
    () => payments.filter((payment) => payment.status === 'PENDING').length,
    [payments],
  );

  return (
    <Box>
      {/* Search + status filter toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            flexWrap: 'wrap',
            alignItems: { sm: 'center' },
          }}
        >
          <TextField
            size="small"
            placeholder="Search by member, email, or reference"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flexGrow: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            aria-label="Search payments"
          />
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
            <InputLabel id="payment-status-filter-label">Status</InputLabel>
            <Select
              labelId="payment-status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as PaymentVerificationStatus | 'ALL')
              }
            >
              {STATUS_FILTERS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField select size="small" label="Receipt" value={receiptFilter} sx={{ minWidth: 170 }}
            onChange={(event) => setReceiptFilter(event.target.value as 'ALL' | 'ATTACHED' | 'MISSING')}>
            <MenuItem value="ALL">All receipts</MenuItem>
            <MenuItem value="ATTACHED">Attached</MenuItem>
            <MenuItem value="MISSING">Missing</MenuItem>
          </TextField>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} disabled={isFetching} onClick={() => refetch()}>Refresh</Button>
        </Box>
      </Paper>

      {isLoading || (!data && isFetching) ? (
        <Paper sx={{ p: 2 }}>
          {[0, 1, 2, 3, 4].map((key) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="rounded" height={14} width="40%" sx={{ mb: 0.75 }} />
                <Skeleton variant="rounded" height={12} width="28%" />
              </Box>
              <Skeleton variant="rounded" width={110} height={20} />
              <Skeleton variant="rounded" width={70} height={32} />
            </Box>
          ))}
        </Paper>
      ) : isError ? (
        <Paper sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {paymentError(error)}
          </Alert>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => refetch()}>
            Retry
          </Button>
        </Paper>
      ) : visible.length === 0 ? (
        <Paper sx={{ py: 7, px: 3, textAlign: 'center' }}>
          {payments.length === 0 && !filtersActive ? (
            <>
              <PaymentsOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No payments recorded yet
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Payment claims recorded by members appear here for verification.
              </Typography>
            </>
          ) : (
            <>
              <SearchOffOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No payments match your filters
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
                Try a different search term or status.
              </Typography>
              <Button variant="outlined" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          )}
        </Paper>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {isFetching ? 'Updating…' : `Showing ${visible.length} payments`}
            {statusFilter === 'ALL' && pendingCount > 0
              ? ` · ${pendingCount} pending claims`
              : ''}
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Receipt</TableCell>
                  <TableCell>Cycle</TableCell>
                  <TableCell>Claim recorded</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Contribution</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            fontSize: '0.75rem',
                            bgcolor: 'primary.main',
                          }}
                        >
                          {payment.contribution?.member?.user?.name
                            ? getInitials(payment.contribution.member.user.name)
                            : '?'}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                            {payment.contribution?.member?.user?.name ?? 'Unknown member'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {payment.contribution?.member?.user?.email ?? '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {formatCurrency(payment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere', maxWidth: 240 }}>
                        {payment.transactionReference}
                      </Typography>
                    </TableCell>
                    <TableCell>{payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? 'Not recorded' : 'Not recorded'}</TableCell>
                    <TableCell>{payment.receipt ? 'Attached' : 'Missing'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {cycleNameFor(cycles, payment.contribution?.cycleId)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(payment.paidAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={paymentStatusLabel(payment)}
                        size="small"
                        color={paymentStatusColor(payment.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {payment.contribution ? (
                        <Chip
                          label={payment.contribution.status}
                          size="small"
                          variant="outlined"
                          color={contributionStatusColor(payment.contribution.status)}
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setDetailsId(payment.id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <PaymentDetailsDialog
        open={detailsId !== null}
        onClose={() => setDetailsId(null)}
        committeeId={committeeId}
        paymentId={detailsId}
        cycles={cycles}
        canManage={canManage}
      />
    </Box>
  );
}
