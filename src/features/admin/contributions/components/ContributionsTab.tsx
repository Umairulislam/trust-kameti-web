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
  Pagination,
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
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import type { ContributionStatus, Cycle } from '@/types';
import { formatCurrency, formatDate, getInitials } from '@/utils';
import { useGetContributionSummaryQuery, useGetContributionsQuery } from '@/features/committees';
import { useGetPaymentsQuery } from '@/features/payments';
import { GenerateContributionsAction } from './GenerateContributionsAction';
import { ContributionPaymentAction } from './ContributionPaymentAction';
import { adminPaymentError } from '../utils/paymentActions';
import { useMarkContributionsOverdueMutation } from '../api/adminContributionsApi';
import {
  canMarkOverdue,
  contributionStatusColor,
  isContributionBearingCycle,
} from '../utils/statusFlow';
import { CycleSelector, CycleStatusChip } from './CycleSelector';
import { CycleSummaryCards } from './CycleSummaryCards';
import { ConfirmDialog } from './ConfirmDialog';
import { ReminderDialog } from './ReminderDialog';

/** Contribution status filter options — "ALL" plus every documented status. */
const STATUS_FILTERS: Array<ContributionStatus | 'ALL'> = ['ALL', 'PENDING', 'PAID', 'OVERDUE'];

/** Single-page fetch bound; matches the admin listings cap. */
const LIST_LIMIT = 100;

interface ContributionsTabProps {
  canManage: boolean;
  committeeId: string;
  committeeName: string;
  /** All committee cycles (backend order: cycle number ascending). */
  cycles: Cycle[];
  /** Currently selected cycle, owned by the parent so it survives tab switches. */
  cycle: Cycle | null;
  onCycleChange: (cycleId: string) => void;
}

/**
 * Member contribution status per cycle — the Phase 5 "Contribution list by
 * committee/cycle" view.
 *
 * Reads GET /committees/:cid/cycles/:cycleId/contributions (status is a
 * documented server-side filter; member search is client-side) and the cycle
 * summary endpoint. Documented actions cover contribution generation,
 * payment claims and reviews, marking overdue, and committee reminders.
 */
export function ContributionsTab({
  canManage,
  committeeId,
  committeeName,
  cycles,
  cycle,
  onCycleChange,
}: ContributionsTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContributionStatus | 'ALL'>('ALL');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [overdueConfirmOpen, setOverdueConfirmOpen] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [markOverdue, overdueResult] = useMarkContributionsOverdueMutation();

  const cycleId = cycle?.id ?? null;

  const {
    currentData: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    isError: summaryError,
    refetch: refetchSummary,
  } = useGetContributionSummaryQuery(
    { committeeId, cycleId: cycleId ?? '' },
    { skip: !cycleId, refetchOnMountOrArgChange: true },
  );

  const {
    currentData: data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetContributionsQuery(
    {
      committeeId,
      cycleId: cycleId ?? '',
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: LIST_LIMIT,
      page,
    },
    { skip: !cycleId, refetchOnMountOrArgChange: true },
  );

  const { currentData: payments, isFetching: paymentsFetching, isError: paymentsError, refetch: refetchPayments } = useGetPaymentsQuery(
    { committeeId }, { refetchOnMountOrArgChange: true },
  );

  const contributions = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contributions;
    return contributions.filter((contribution) =>
      `${contribution.member?.user?.name ?? ''} ${contribution.member?.user?.email ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [contributions, search]);

  const filtersActive = statusFilter !== 'ALL' || search.trim() !== '';
  const clearFilters = () => {
    setPage(1);
    setSearch('');
    setStatusFilter('ALL');
  };

  const handleMarkOverdue = async () => {
    if (!cycleId || !cycle || !canManage || !canMarkOverdue(cycle.status) || overdueResult.isLoading) return;
    setOverdueError(null);
    try {
      const response = await markOverdue({ committeeId, cycleId }).unwrap();
      setSuccessMessage(
        response.marked === 0
          ? 'No past-due PENDING contributions were found in this cycle.'
          : `Marked ${response.marked} past-due contribution${response.marked === 1 ? '' : 's'} overdue.`,
      );
      setOverdueConfirmOpen(false);
    } catch (err: unknown) {
      setOverdueError(adminPaymentError(err, 'review'));
    }
  };

  // No cycles exist yet — cycle management (Phase 6) creates them.
  if (cycles.length === 0) {
    return (
      <Paper sx={{ py: 7, px: 3, textAlign: 'center' }}>
        <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No cycles yet
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 480, mx: 'auto' }}>
          Create cycles in Cycle Management, then return here to generate contributions for the active cycle.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Cycle toolbar: selector + admin actions */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { sm: 'center' },
            flexWrap: { md: 'wrap' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <CycleSelector cycles={cycles} value={cycleId} onChange={onCycleChange} />
            {cycle && <CycleStatusChip cycle={cycle} />}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<EventBusyOutlinedIcon />}
              disabled={!canManage || !cycle || !canMarkOverdue(cycle.status) || overdueResult.isLoading}
              onClick={() => {
                setOverdueError(null);
                setOverdueConfirmOpen(true);
              }}
            >
              Mark Overdue
            </Button>
            <Button
              variant="contained"
              startIcon={<NotificationsActiveOutlinedIcon />}
              onClick={() => setReminderOpen(true)}
              disabled={!canManage}
            >
              Send Reminder
            </Button>
          </Box>
        </Box>

        {/* Cycle meta line — totals come from the cycle record itself. */}
        {cycle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)} · Expected{' '}
            {formatCurrency(cycle.totalExpected)} · Collected{' '}
            {formatCurrency(cycle.totalCollected)}
          </Typography>
        )}
      </Paper>

      {cycle && <GenerateContributionsAction key={cycle.id} committeeId={committeeId} cycle={cycle}
        summary={summaryError ? undefined : summary} checking={summaryFetching} canManage={canManage} onRefresh={() => refetchSummary()} />}
      {paymentsError && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => refetchPayments()}>Retry</Button>}>
        Existing payment claims could not be checked. Payment recording is disabled until this check succeeds.
      </Alert>}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {cycle && !isContributionBearingCycle(cycle.status) ? (
        <Paper sx={{ py: 6, px: 3, textAlign: 'center' }}>
          <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            This cycle has not started yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Start the cycle in Cycle Management, then use Generate contributions here. Contributions are not created automatically when a cycle starts.
          </Typography>
        </Paper>
      ) : (
        <>
          {summaryError ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Contribution summary is unavailable right now. The list below is still authoritative.
            </Alert>
          ) : (
            <Box sx={{ mb: 3 }}>
              <CycleSummaryCards summary={summary} isLoading={summaryLoading} />
            </Box>
          )}

          {/* Search + status filter toolbar */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                alignItems: { sm: 'center' },
              }}
            >
              <TextField
                size="small"
                placeholder="Search by member name or email"
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
                aria-label="Search contributions"
              />
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
                <InputLabel id="contribution-status-filter-label">Status</InputLabel>
                <Select
                  labelId="contribution-status-filter-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(event) =>
                    { setStatusFilter(event.target.value as ContributionStatus | 'ALL'); setPage(1); }
                  }
                >
                  {STATUS_FILTERS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status === 'ALL' ? 'All statuses' : status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" disabled={isFetching || summaryFetching || paymentsFetching} onClick={() => { refetch(); refetchSummary(); refetchPayments(); }}>Refresh</Button>
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
                  <Skeleton variant="rounded" width={100} height={20} />
                  <Skeleton variant="rounded" width={90} height={20} />
                </Box>
              ))}
            </Paper>
          ) : isError ? (
            <Paper sx={{ p: 3 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                {(error as { data?: { message?: string } })?.data?.message ??
                  'Failed to load contributions. Please try again.'}
              </Alert>
              <Button
                variant="outlined"
                startIcon={<RefreshOutlinedIcon />}
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </Paper>
          ) : visible.length === 0 ? (
            <Paper sx={{ py: 7, px: 3, textAlign: 'center' }}>
              {contributions.length === 0 && !filtersActive ? (
                <>
                  <AccountBalanceWalletOutlinedIcon
                    sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }}
                  />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No contributions in this cycle
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    {cycle?.status === 'ACTIVE' ? 'Use Generate contributions above to create payment obligations for active members.' : 'No contributions were recorded for this cycle.'}
                  </Typography>
                </>
              ) : (
                <>
                  <SearchOffOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No contributions match your filters
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
                {isFetching ? 'Updating…' : `Showing ${visible.length} of ${total} contributions`}
                {total > contributions.length ? ` (page ${page}; search applies to this page)` : ''}
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Member</TableCell>
                      <TableCell align="right">Expected amount</TableCell>
                      <TableCell>Due date</TableCell>
                      <TableCell>Paid on</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Payment action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map((contribution) => (
                      <TableRow key={contribution.id} hover>
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
                              {contribution.member?.user?.name
                                ? getInitials(contribution.member.user.name)
                                : '?'}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                {contribution.member?.user?.name ?? 'Unknown member'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {contribution.member?.user?.email ?? '—'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {formatCurrency(contribution.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(contribution.dueDate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(contribution.paidAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={contribution.status}
                            size="small"
                            color={contributionStatusColor(contribution.status)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {cycle && <ContributionPaymentAction committeeId={committeeId} contribution={contribution} cycle={cycle}
                            payments={payments ?? []} checking={paymentsFetching || paymentsError || isFetching} canManage={canManage} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {total > LIST_LIMIT && <Pagination sx={{ mt: 2 }} count={Math.ceil(total / LIST_LIMIT)} page={page}
            onChange={(_, nextPage) => { setPage(nextPage); setSearch(''); }} disabled={isFetching} aria-label="Contribution pages" />}
        </>
      )}

      <ReminderDialog
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        committeeId={committeeId}
        committeeName={committeeName}
      />

      <ConfirmDialog
        open={overdueConfirmOpen}
        title="Mark Contributions Overdue"
        confirmLabel="Mark Overdue"
        confirmColor="warning"
        loading={overdueResult.isLoading}
        errorMessage={overdueError}
        onConfirm={handleMarkOverdue}
        onClose={() => (overdueResult.isLoading ? undefined : setOverdueConfirmOpen(false))}
      >
        Flip every past-due PENDING contribution of <strong>Cycle {cycle?.cycleNumber}</strong> to
        OVERDUE? The backend decides which contributions qualify and records the change in the audit
        trail.
      </ConfirmDialog>
    </Box>
  );
}
