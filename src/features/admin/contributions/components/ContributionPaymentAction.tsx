'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import type { Contribution, Cycle, Payment } from '@/types';
import { PayContributionDialog } from '@/features/payments';
import { canRecordPayment } from '../utils/paymentActions';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';

export function ContributionPaymentAction({ committeeId, contribution, cycle, payments, checking, canManage }: {
  committeeId: string;
  contribution: Contribution;
  cycle: Cycle;
  payments: Payment[];
  checking: boolean;
  canManage: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const pending = payments.find((payment) => payment.contributionId === contribution.id && payment.status === 'PENDING');
  const paymentId = contribution.paymentId ?? pending?.id;

  return (
    <>
      <Button size="small" disabled={checking || !canManage || (!paymentId && !canRecordPayment(contribution, cycle.status))}
        onClick={() => paymentId ? setReviewing(true) : setRecording(true)}>
        {paymentId ? 'View claim' : 'Record payment'}
      </Button>
      <PayContributionDialog open={recording} onClose={() => setRecording(false)} committeeId={committeeId}
        contribution={contribution} cycleNumber={cycle.cycleNumber} pendingPayment={pending}
        onBehalfOf={contribution.member?.user?.name ?? 'this member'} />
      <PaymentDetailsDialog open={reviewing} onClose={() => setReviewing(false)} committeeId={committeeId}
        paymentId={paymentId ?? null} cycles={[cycle]} canManage={canManage} />
    </>
  );
}
