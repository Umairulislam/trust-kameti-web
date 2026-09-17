"use client"

import { useState } from "react"
import { Alert, Box, Button, Paper } from "@mui/material"
import { useAuth } from "@/features/auth"
import { useGetContributionsQuery, useGetCyclesQuery } from "@/features/committees"
import {
  PayContributionDialog,
  PaymentDetailsDialog,
  useGetPaymentsQuery,
} from "@/features/payments"
import { ContributionHistoryList } from "./ContributionHistoryList"
import { CurrentContributionCard } from "./CurrentContributionCard"

interface UserContributionsPanelProps {
  committeeId: string
}

/**
 * User-side contributions panel for a committee.
 * Shows the current cycle's contribution (amount, due date, status, pay
 * action) and the contribution history by cycle.
 */
export function UserContributionsPanel({ committeeId }: UserContributionsPanelProps) {
  const { user } = useAuth()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [detailsPaymentId, setDetailsPaymentId] = useState<string | null>(null)

  const {
    data: cyclesData,
    isLoading: cyclesLoading,
    isError: cyclesError,
    error: cyclesErrorData,
  } = useGetCyclesQuery({ committeeId, limit: 50 }, { refetchOnMountOrArgChange: true })

  const activeCycle = cyclesData?.data.find((cycle) => cycle.status === "ACTIVE")

  const {
    data: contributionsData,
    isLoading: contributionsLoading,
    isError: contributionsError,
    error: contributionsErrorData,
  } = useGetContributionsQuery(
    { committeeId, cycleId: activeCycle?.id ?? "", limit: 100 },
    { skip: !activeCycle, refetchOnMountOrArgChange: true }
  )

  // Payment claims provide the awaiting-verification / rejected context
  // for the current contribution card.
  const {
    currentData: payments,
    isFetching: paymentsFetching,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useGetPaymentsQuery({ committeeId }, { refetchOnMountOrArgChange: true })

  const myContribution = contributionsData?.data.find(
    (contribution) => Boolean(user?.id) && contribution.member?.user?.id === user?.id
  )

  // Payments are listed newest first, so this is the latest claim.
  const myLatestPayment = myContribution
    ? payments?.find((payment) => payment.contributionId === myContribution.id)
    : undefined

  if (cyclesLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ height: 20, bgcolor: "action.hover", borderRadius: 1, mb: 2, width: "35%" }} />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i}>
                <Box
                  sx={{
                    height: 12,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    mb: 0.5,
                    width: "60%",
                  }}
                />
                <Box sx={{ height: 24, bgcolor: "action.hover", borderRadius: 1, width: "50%" }} />
              </Box>
            ))}
          </Box>
        </Paper>
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ height: 20, bgcolor: "action.hover", borderRadius: 1, mb: 2, width: "35%" }} />
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "50%", bgcolor: "action.hover" }} />
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{
                    height: 14,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    mb: 0.5,
                    width: "40%",
                  }}
                />
                <Box sx={{ height: 12, bgcolor: "action.hover", borderRadius: 1, width: "60%" }} />
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>
    )
  }

  if (cyclesError) {
    const errorMessage =
      (cyclesErrorData as { data?: { message?: string } })?.data?.message ??
      "Failed to load contributions. Please try again."
    return <Alert severity="error">{errorMessage}</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {paymentsError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => refetchPayments()}>
              Retry
            </Button>
          }
        >
          Could not check existing payment claims. Retry before submitting a new claim.
        </Alert>
      )}
      {/* Current contribution */}
      {!activeCycle ? (
        <Alert severity="info">
          No active cycle. Your contribution will appear when a cycle is active.
        </Alert>
      ) : contributionsLoading ? (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ height: 20, bgcolor: "action.hover", borderRadius: 1, mb: 2, width: "35%" }} />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i}>
                <Box
                  sx={{
                    height: 12,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    mb: 0.5,
                    width: "60%",
                  }}
                />
                <Box sx={{ height: 24, bgcolor: "action.hover", borderRadius: 1, width: "50%" }} />
              </Box>
            ))}
          </Box>
        </Paper>
      ) : contributionsError ? (
        <Alert severity="error">
          {(contributionsErrorData as { data?: { message?: string } })?.data?.message ??
            "Failed to load your contribution. Please try again."}
        </Alert>
      ) : !myContribution ? (
        <Alert severity="info">
          No contribution has been generated for you in the current cycle yet.
        </Alert>
      ) : (
        <CurrentContributionCard
          contribution={myContribution}
          cycleNumber={activeCycle.cycleNumber}
          latestPayment={myLatestPayment}
          paymentCheckPending={paymentsFetching || paymentsError}
          onPay={() => setPayDialogOpen(true)}
          onViewPayment={(paymentId) => setDetailsPaymentId(paymentId)}
        />
      )}

      {/* History by cycle */}
      <ContributionHistoryList
        committeeId={committeeId}
        cycles={cyclesData?.data ?? []}
        currentUserId={user?.id}
      />

      {/* Payment flow */}
      {myContribution && (
        <PayContributionDialog
          open={payDialogOpen}
          onClose={() => setPayDialogOpen(false)}
          committeeId={committeeId}
          contribution={myContribution}
          cycleNumber={activeCycle?.cycleNumber}
          pendingPayment={myLatestPayment?.status === "PENDING" ? myLatestPayment : undefined}
        />
      )}

      <PaymentDetailsDialog
        open={Boolean(detailsPaymentId)}
        onClose={() => setDetailsPaymentId(null)}
        committeeId={committeeId}
        paymentId={detailsPaymentId}
        cycles={cyclesData?.data ?? []}
      />
    </Box>
  )
}
