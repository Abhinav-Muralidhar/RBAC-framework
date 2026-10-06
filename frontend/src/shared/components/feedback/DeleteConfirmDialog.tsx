import { ConfirmDialog } from '@shared/components/feedback/ConfirmDialog';

type DeleteConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  itemName?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmDialog({
  open,
  title = 'Delete Record',
  message,
  itemName,
  isLoading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      itemName={itemName}
      confirmLabel="Delete"
      variant="danger"
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
