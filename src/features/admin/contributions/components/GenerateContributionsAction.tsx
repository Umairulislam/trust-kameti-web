'use client';

import { useRef, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import type { ContributionSummary, Cycle } from '@/types';
import { useGenerateContributionsMutation } from '../api/adminContributionsApi';
import { adminPaymentError, canGenerateContributions } from '../utils/paymentActions';
import { ConfirmDialog } from './ConfirmDialog';

interface GenerateContributionsActionProps {
  committeeId: string;
  cycle: Cycle;
  summary?: ContributionSummary;
  checking: boolean;
  canManage: boolean;
  onRefresh: () => void;
}

export function GenerateContributionsAction({ committeeId, cycle, summary, checking, canManage, onRefresh }: GenerateContributionsActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<number | null>(null);
  const [generate, { isLoading }] = useGenerateContributionsMutation();
  const locked = useRef(false);
  const allowed = canManage && !checking && canGenerateContributions(cycle.status, summary?.memberCount);

  const handleGenerate = async () => {
    if (locked.current || !allowed) return;
    locked.current = true;
    setError(null);
    try {
      const result = await generate({ committeeId, cycleId: cycle.id }).unwrap();
      setGenerated(result.generated);
      setOpen(false);
    } catch (err: unknown) {
      setError(adminPaymentError(err, 'generate'));
    } finally {
      locked.current = false;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity="info">
        {cycle.status !== 'ACTIVE' ? 'Start this cycle before generating member contributions.' : summary && summary.memberCount > 0
          ? 'Contributions have already been generated for this cycle.'
          : 'After starting a cycle, generate its contributions so active members can submit payment proof.'}
      </Alert>
      <Button sx={{ mt: 1, width: { xs: '100%', sm: 'auto' } }} disabled={!allowed || isLoading}
        onClick={() => { setError(null); setOpen(true); }}>Generate contributions</Button>
      {!checking && !summary && <Button onClick={onRefresh}>Retry contribution check</Button>}
      {generated !== null && <Alert severity="success" sx={{ mt: 1 }} onClose={() => setGenerated(null)}>
        Generated {generated} contribution{generated === 1 ? '' : 's'} for Cycle {cycle.cycleNumber}. Members can now record their transfers and upload receipts.
      </Alert>}
      <ConfirmDialog open={open} title="Generate contributions" confirmLabel="Generate contributions"
        loading={isLoading} confirmDisabled={!allowed} errorMessage={error} onConfirm={handleGenerate} onClose={() => setOpen(false)}>
        <Typography component="span">
          Generate contributions for all active members in Cycle {cycle.cycleNumber}? The backend sets each amount and due date from the committee settings. This does not record or verify any payment.
        </Typography>
      </ConfirmDialog>
    </Box>
  );
}
