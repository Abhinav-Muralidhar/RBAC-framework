import { ConfirmDialog } from '@shared/components/feedback/ConfirmDialog';

export interface ConfirmModalProps {
    isOpen: boolean;
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

export function ConfirmModal({
    isOpen,
    title = 'Confirm Action',
    message,
    itemName,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    return (
        <ConfirmDialog
            open={isOpen}
            title={title}
            message={message}
            itemName={itemName}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            variant={variant}
            isLoading={isLoading}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
