'use client';

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body content — a string or nodes describing the target of the action. */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** MUI button color for the confirm action. */
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Server error to surface inside the dialog. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Small reusable confirmation dialog for important contribution/payment admin
 * actions (mark contributions overdue, verify payment, reject payment). The
 * caller owns the mutation and passes `onConfirm`; this component only handles
 * the confirm/cancel UI plus the loading and error states.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  confirmDisabled = false,
  errorMessage = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {children && <DialogContentText component="div">{children}</DialogContentText>}
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} color="inherit">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} disabled={loading || confirmDisabled} color={confirmColor} variant="contained">
          {loading ? <CircularProgress size={18} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
