import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { Button } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message,
  itemName,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !isLoading && onCancel()}>
      <AlertDialogContent className="bg-white backdrop-blur-none">
        <AlertDialogHeader className="gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl',
                isDanger ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-600'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className={cn(isDanger ? 'text-red-950' : '')}>
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription>{message}</AlertDialogDescription>
              {itemName ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-3 py-2 font-mono text-sm text-slate-700">
                  {itemName}
                </div>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" disabled={isLoading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            className={cn(
              isDanger &&
                'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_16px_34px_-20px_rgba(220,38,38,0.85)] hover:bg-red-600'
            )}
            onClick={onConfirm}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
