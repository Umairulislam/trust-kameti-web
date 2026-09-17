'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { AdminPageContainer } from '@/components/layout/admin';
import { useGetCommitteeQuery } from '@/features/admin/committees';
import { committeeStatusColor } from '@/features/admin/committees/utils/statusFlow';
import { useGetCyclesQuery } from '@/features/committees';
import { useAuth } from '@/features/auth';
import { canManageCommitteePayments } from '../utils/paymentActions';
import { formatCurrency } from '@/utils';
import { isContributionBearingCycle } from '../utils/statusFlow';
import { ContributionsTab } from './ContributionsTab';
import { PaymentsTab } from './PaymentsTab';

/** Single-page fetch bound; matches the admin listings cap. */
const LIST_LIMIT = 100;

/**
 * Admin contribution & payment management for a single committee
 * (`/admin/contributions/:committeeId`).
 *
 * Loads the committee for context (GET /committees/:id) and its cycles
 * (GET /committees/:committeeId/cycles, ascending by cycle number). The
 * Contributions tab is cycle-scoped; the Payments tab is committee-wide.
 * Selected-cycle state lives here so it survives tab switches.
 */
export function CommitteeContributionsAdmin() {
  const { user } = useAuth();
  const params = useParams();
  const committeeId = params.committeeId as string;
  const [tab, setTab] = useState(0);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const {
    data: committee,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCommitteeQuery({ id: committeeId });

  const {
    data: cyclesData,
    isLoading: cyclesLoading,
    isError: cyclesError,
    error: cyclesErrorData,
    refetch: refetchCycles,
  } = useGetCyclesQuery({ committeeId, limit: LIST_LIMIT });

  const cycles = useMemo(() => cyclesData?.data ?? [], [cyclesData]);

  // Prioritise the active cycle, then the newest contribution-bearing cycle.
  // The user's explicit choice always wins once made.
  const defaultCycleId = useMemo(() => {
    const active = cycles.find((item) => item.status === 'ACTIVE');
    if (active) return active.id;
    for (let index = cycles.length - 1; index >= 0; index -= 1) {
      if (isContributionBearingCycle(cycles[index].status)) return cycles[index].id;
    }
    return cycles.length > 0 ? cycles[cycles.length - 1].id : null;
  }, [cycles]);

  const effectiveCycleId = selectedCycleId ?? defaultCycleId;
  const cycle = cycles.find((item) => item.id === effectiveCycleId) ?? null;

  const crumbs = [
    { label: 'Contributions & Payments', href: '/admin/contributions' },
    { label: committee?.name ?? 'Committee' },
  ];

  if (isLoading) {
    return (
      <AdminPageContainer title="Contributions & Payments" breadcrumbs={crumbs}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      </AdminPageContainer>
    );
  }

  if (isError) {
    const message =
      (error as { data?: { message?: string } })?.data?.message ??
      'Failed to load this committee.';
    return (
      <AdminPageContainer title="Contributions & Payments" breadcrumbs={crumbs}>
        <Alert severity="error" icon={<ErrorOutlineOutlinedIcon />} sx={{ mb: 2 }}>
          {message}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            component={Link}
            href="/admin/contributions"
            startIcon={<ArrowBackOutlinedIcon />}
            variant="outlined"
          >
            Back to Contributions
          </Button>
          <Button onClick={() => refetch()} startIcon={<RefreshOutlinedIcon />}>
            Retry
          </Button>
        </Box>
      </AdminPageContainer>
    );
  }

  if (!committee) {
    return (
      <AdminPageContainer title="Contributions & Payments" breadcrumbs={crumbs}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Committee not found.
        </Alert>
        <Button
          component={Link}
          href="/admin/contributions"
          startIcon={<ArrowBackOutlinedIcon />}
          variant="outlined"
        >
          Back to Contributions
        </Button>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer
      title="Contributions & Payments"
      breadcrumbs={crumbs}
      actions={
        <Button
          component={Link}
          href={`/admin/committees/${committee.id}`}
          variant="outlined"
          startIcon={<ArrowBackOutlinedIcon />}
        >
          View Committee
        </Button>
      }
    >
      {/* Committee context header */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <AccountBalanceWalletOutlinedIcon color="primary" sx={{ fontSize: 40 }} />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="h6" noWrap>
              {committee.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Member limit {committee.memberLimit} · Contribution{' '}
              {formatCurrency(committee.contributionAmount)} · {committee.totalCycles} cycles
            </Typography>
          </Box>
          <Chip label={committee.status} color={committeeStatusColor(committee.status)} />
        </Box>
      </Paper>

      {cyclesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : cyclesError ? (
        <Box>
          <Alert severity="error" icon={<ErrorOutlineOutlinedIcon />} sx={{ mb: 2 }}>
            {(cyclesErrorData as { data?: { message?: string } })?.data?.message ??
              'Failed to load the committee cycles. Please try again.'}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => refetchCycles()}
          >
            Retry
          </Button>
        </Box>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_event, value) => setTab(value)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Contributions" />
            <Tab label="Payments" />
          </Tabs>

          {tab === 0 ? (
            <ContributionsTab
              key={`${committee.id}-${cycle?.id ?? 'none'}`}
              canManage={canManageCommitteePayments(user, committee.createdBy)}
              committeeId={committee.id}
              committeeName={committee.name}
              cycles={cycles}
              cycle={cycle}
              onCycleChange={setSelectedCycleId}
            />
          ) : (
            <PaymentsTab key={committee.id} committeeId={committee.id} cycles={cycles} canManage={canManageCommitteePayments(user, committee.createdBy)} />
          )}
        </>
      )}
    </AdminPageContainer>
  );
}
