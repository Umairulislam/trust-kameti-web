/**
 * Shared application types.
 * Feature-specific types belong inside their own feature folder.
 * Only put types here when they are used across multiple features.
 */

/** User roles as defined by the backend. */
export type UserRole = 'USER' | 'ADMIN';

/** User account statuses as defined by the backend. */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/** Committee lifecycle statuses. */
export type CommitteeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/** Cycle statuses. */
export type CycleStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/** Contribution statuses. */
export type ContributionStatus = 'PENDING' | 'PAID' | 'OVERDUE';

/** Payment verification statuses. */
export type PaymentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type PaymentMethod = 'EASYPAISA' | 'JAZZCASH' | 'BANK_TRANSFER' | 'OTHER';

export interface PaymentReceipt {
  id: string;
  mimeType: 'image/png' | 'image/jpeg';
  size: number;
  uploadedAt: string;
}

/** Payout statuses. */
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** Membership statuses. */
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'REMOVED';

/** Member roles within a committee. */
export type MemberRole = 'ADMIN' | 'MEMBER';

/** Payout methods — only LOTTERY is supported in the current product scope. */
export type PayoutMethod = 'LOTTERY';

/** Notification types. */
export type NotificationType =
  | 'COMMITTEE_INVITATION'
  | 'COMMITTEE_STATUS_CHANGED'
  | 'CYCLE_STARTED'
  | 'CYCLE_COMPLETED'
  | 'CONTRIBUTION_REMINDER'
  | 'CONTRIBUTION_OVERDUE'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'LOTTERY_COMPLETED'
  | 'PAYOUT_COMPLETED'
  | 'GENERAL';

/** Audit actions as recorded by the backend (immutable audit trail). */
export type AuditAction =
  | 'COMMITTEE_CREATED'
  | 'COMMITTEE_UPDATED'
  | 'COMMITTEE_STATUS_CHANGED'
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'PAYMENT_RECEIPT_UPLOADED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'CONTRIBUTION_STATUS_CHANGED'
  | 'LOTTERY_EXECUTED'
  | 'PAYOUT_CREATED'
  | 'PAYOUT_STATUS_CHANGED';

/** Paginated response envelope returned by all list endpoints. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Error shape returned by the backend for all non-2xx responses. */
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

/** Safe user object returned by auth endpoints (no passwordHash). */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

/** Committee record as returned by the backend. */
export interface Committee {
  id: string;
  name: string;
  description: string | null;
  contributionAmount: string;
  memberLimit: number;
  totalCycles: number;
  payoutMethod: PayoutMethod;
  startDate: string | null;
  dueDay: number;
  status: CommitteeStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Cycle record. */
export interface Cycle {
  id: string;
  committeeId: string;
  cycleNumber: number;
  startDate: string | null;
  endDate: string | null;
  status: CycleStatus;
  totalExpected: string;
  totalCollected: string;
  createdAt: string;
  updatedAt: string;
}

/** Contribution record. */
export interface Contribution {
  id: string;
  cycleId: string;
  memberId: string;
  amount: string;
  status: ContributionStatus;
  dueDate: string;
  paidAt: string | null;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Paying member, nested in contribution list/detail responses. */
  member?: Member;
}

/** Contribution subset nested within payment responses. */
export type PaymentContribution = Pick<
  Contribution,
  'id' | 'cycleId' | 'memberId' | 'amount' | 'status'
> & {
  member?: Pick<Member, 'id' | 'role' | 'status' | 'user'>;
  cycle?: Pick<Cycle, 'committeeId' | 'status'>;
};

/** Payment record as returned by the payments endpoints. */
export interface Payment {
  id: string;
  contributionId: string;
  memberId: string;
  amount: string;
  transactionReference: string;
  paymentMethod: PaymentMethod | null;
  receipt: PaymentReceipt | null;
  status: PaymentVerificationStatus;
  paidAt: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contribution?: PaymentContribution;
}

/** Payout record. */
export interface Payout {
  id: string;
  cycleId: string;
  memberId: string;
  amount: string;
  status: PayoutStatus;
  paidAt: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  cycle?: Cycle & { committeeId?: string };
  member?: Member;
}

/** Member record with nested user. */
export interface Member {
  id: string;
  committeeId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'phone'>;
}

/** Notification record. */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  committeeId: string | null;
  /** Invitation token — only present for COMMITTEE_INVITATION notifications. */
  token: string | null;
  createdAt: string;
}

/** Notification list response with unread count. */
export interface NotificationListResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

/** My-committees membership response shape. */
export interface MyCommitteeMembership {
  committee: Committee;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
}

/** Contribution summary for a cycle. */
export interface ContributionSummary {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  memberCount: number;
}

/** Committee report summary from /committees/:id/reports/summary. */
export interface CommitteeReportSummary {
  committeeId: string;
  name: string;
  description: string | null;
  status: CommitteeStatus;
  contributionAmount: number;
  memberLimit: number;
  totalCycles: number;
  dueDay: number;
  startDate: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  activeMemberCount: number;
  cycleCount: number;
  completedCycleCount: number;
}

/** Lottery result record. */
export interface LotteryResult {
  id: string;
  cycleId: string;
  winnerMemberId: string;
  eligibleMemberCount: number;
  executedAt: string;
  executedBy: string;
  createdAt: string;
  cycle?: Pick<Cycle, 'id' | 'cycleNumber' | 'status'>;
  winner?: Member;
}

/** Immutable audit entry as returned by the audit-log endpoints. */
export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  committeeId: string;
  cycleId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
