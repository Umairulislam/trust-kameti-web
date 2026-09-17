'use client';

import type { ElementType } from 'react';
import {
  Avatar,
  Box,
  Divider,
  Paper,
  Typography,
} from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import type { AuditAction, AuditLog } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils';

interface CommitteeTimelineProps {
  /** Audit entries in chronological order (oldest first), as returned by the backend. */
  events: AuditLog[];
  loading?: boolean;
  /** Maps a user id to the display name of the member who performed an action. */
  actorNames: Map<string, string>;
  /** Maps a cycle id to its cycle number. */
  cycleNumbers: Map<string, number>;
  /** The authenticated user's id, used to flag their own actions. */
  currentUserId?: string;
}

/** Icon and color used to visualise each kind of audit event. */
interface AuditEventVisual {
  label: string;
  icon: ElementType;
  bg: string;
  fg: string;
}

/** Maps an audit action to a human-friendly label, icon, and color. */
function auditEventVisual(action: AuditAction): AuditEventVisual {
  switch (action) {
    case 'COMMITTEE_CREATED':
      return { label: 'Committee created', icon: GroupsOutlinedIcon, bg: 'primary.main', fg: 'primary.contrastText' };
    case 'COMMITTEE_UPDATED':
      return { label: 'Committee details updated', icon: SettingsOutlinedIcon, bg: 'info.main', fg: 'info.contrastText' };
    case 'COMMITTEE_STATUS_CHANGED':
      return { label: 'Committee status changed', icon: FlagOutlinedIcon, bg: 'warning.main', fg: 'warning.contrastText' };
    case 'MEMBER_INVITED':
      return { label: 'Member invited', icon: PersonAddOutlinedIcon, bg: 'info.main', fg: 'info.contrastText' };
    case 'MEMBER_JOINED':
      return { label: 'Member joined', icon: HowToRegOutlinedIcon, bg: 'success.main', fg: 'success.contrastText' };
    case 'MEMBER_REMOVED':
      return { label: 'Member removed', icon: PersonRemoveOutlinedIcon, bg: 'error.main', fg: 'error.contrastText' };
    case 'PAYMENT_VERIFIED':
      return { label: 'Payment verified', icon: TaskAltOutlinedIcon, bg: 'success.main', fg: 'success.contrastText' };
    case 'PAYMENT_REJECTED':
      return { label: 'Payment claim rejected', icon: CancelOutlinedIcon, bg: 'error.main', fg: 'error.contrastText' };
    case 'PAYMENT_RECEIPT_UPLOADED':
      return { label: 'Payment receipt uploaded', icon: PaymentsOutlinedIcon, bg: 'info.main', fg: 'info.contrastText' };
    case 'CONTRIBUTION_STATUS_CHANGED':
      return { label: 'Contribution status changed', icon: PaymentsOutlinedIcon, bg: 'warning.main', fg: 'warning.contrastText' };
    case 'LOTTERY_EXECUTED':
      return { label: 'Lottery executed — winner drawn', icon: EmojiEventsOutlinedIcon, bg: 'warning.main', fg: 'warning.contrastText' };
    case 'PAYOUT_CREATED':
      return { label: 'Payout created', icon: AccountBalanceWalletOutlinedIcon, bg: 'secondary.main', fg: 'secondary.contrastText' };
    case 'PAYOUT_STATUS_CHANGED':
      return { label: 'Payout status changed', icon: PaidOutlinedIcon, bg: 'secondary.main', fg: 'secondary.contrastText' };
    default:
      return { label: String(action).replaceAll('_', ' '), icon: HistoryOutlinedIcon, bg: 'action.hover', fg: 'text.secondary' };
  }
}

/** Splits a camelCase metadata key into readable words (e.g. contributionId → Contribution Id). */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

/** Formats a metadata value for display without interpreting its meaning. */
function formatMetadataValue(key: string, value: unknown): string {
  if (typeof value === 'number' && key.toLowerCase().includes('amount')) {
    return formatCurrency(value);
  }
  const text = String(value);
  // Long identifiers (e.g. UUIDs) are shortened for display only.
  return text.length > 20 ? `${text.slice(0, 8)}…` : text;
}

/**
 * Displays the committee's audit trail as a chronological timeline
 * (oldest first). Audit entries are immutable and created only by the
 * backend — this component is strictly read-only.
 */
export function CommitteeTimeline({
  events,
  loading,
  actorNames,
  cycleNumbers,
  currentUserId,
}: CommitteeTimelineProps) {
  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Committee Timeline
        </Typography>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: 'action.hover' }} />
            <Box sx={{ flex: 1, pt: 0.5 }}>
              <Box sx={{ height: 14, bgcolor: 'action.hover', borderRadius: 1, mb: 0.75, width: '40%' }} />
              <Box sx={{ height: 12, bgcolor: 'action.hover', borderRadius: 1, width: '60%' }} />
            </Box>
          </Box>
        ))}
      </Paper>
    );
  }

  if (events.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Committee Timeline
        </Typography>
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <HistoryOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No committee activity yet
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Important events such as payments, cycles, lotteries, and payouts will appear here
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Committee Timeline
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
        {events.length} {events.length === 1 ? 'event' : 'events'} • oldest first
      </Typography>
      <Box>
        {events.map((event, index) => {
          const visual = auditEventVisual(event.action);
          const isLast = index === events.length - 1;
          const actorName = actorNames.get(event.actorId);
          const isCurrentUser = event.actorId === currentUserId;
          const cycleNumber = event.cycleId ? cycleNumbers.get(event.cycleId) : undefined;
          const metadataEntries = event.metadata
            ? Object.entries(event.metadata)
            : [];

          return (
            <Box
              key={event.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                position: 'relative',
                pb: isLast ? 0 : 3,
              }}
            >
              {/* Connector line between events */}
              {!isLast && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 20,
                    top: 48,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'divider',
                  }}
                />
              )}
              <Avatar sx={{ width: 42, height: 42, bgcolor: visual.bg, color: visual.fg }}>
                <visual.icon sx={{ fontSize: 21 }} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {visual.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[
                    isCurrentUser ? 'By you' : actorName ? `By ${actorName}` : null,
                    cycleNumber !== undefined ? `Cycle ${cycleNumber}` : null,
                    formatDateTime(event.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Typography>
                {metadataEntries.length > 0 && (
                  <Box
                    sx={{
                      mt: 1,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      gap: 0.25,
                      px: 1.25,
                      py: 0.75,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    {metadataEntries.map(([key, value]) => (
                      <Typography key={key} variant="caption" color="text.secondary">
                        {humanizeKey(key)}: {formatMetadataValue(key, value)}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Divider sx={{ mt: 3, mb: 1.5 }} />
      <Typography variant="caption" color="text.disabled">
        This timeline is a read-only audit record maintained by the system. Events cannot be
        edited or removed.
      </Typography>
    </Paper>
  );
}
