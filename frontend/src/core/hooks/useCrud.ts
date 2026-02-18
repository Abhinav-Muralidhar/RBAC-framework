/**
 * useCrud Hook
 * 
 * Encapsulates common CRUD operations:
 * - Create/Edit modal management
 * - Delete confirmation modal management
 * - mutation handling
 * - Toast notifications for success/failure
 */

import { useState, useCallback } from 'react';
import { parseApiError } from '../utils';

export interface ToastHandle {
    success: (msg: string) => void;
    error: (msg: string) => void;
}

export interface UseCrudOptions<T> {
    deleteFn: (id: string) => Promise<void>;
    getByIdFn?: (id: string) => Promise<T>;
    entityName: string;
    onSuccess?: () => void;
    toast?: ToastHandle;
}

export interface UseCrudReturn<T> {
    // Error state
    error: string | null;
    setError: (error: string) => void;
    clearError: () => void;

    // Form modal
    showFormModal: boolean;
    editingItem: T | null;
    formLoading: boolean;
    editLoading: boolean;
    setFormLoading: (loading: boolean) => void;
    openCreate: () => void;
    openEdit: (item: T) => Promise<void>;
    closeForm: () => void;
    handleFormSuccess: () => void;

    // Delete modal
    showDeleteModal: boolean;
    deletingItem: T | null;
    deleteLoading: boolean;
    openDelete: (item: T) => void;
    confirmDelete: () => Promise<void>;
    closeDelete: () => void;
}

export function useCrud<T extends { id: string }>({
    deleteFn,
    getByIdFn,
    entityName,
    onSuccess,
    toast,
}: UseCrudOptions<T>): UseCrudReturn<T> {
    const [error, setError] = useState<string | null>(null);

    // Form modal state
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [editLoading, setEditLoading] = useState(false);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingItem, setDeletingItem] = useState<T | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const clearError = useCallback(() => setError(null), []);

    // Form modal handlers
    const openCreate = useCallback(() => {
        setEditingItem(null);
        setShowFormModal(true);
        clearError();
    }, [clearError]);

    const openEdit = useCallback(async (item: T) => {
        clearError();
        if (getByIdFn) {
            setEditLoading(true);
            try {
                const fullItem = await getByIdFn(item.id);
                setEditingItem(fullItem);
            } catch (err) {
                console.error(`Failed to load ${entityName} details`, err);
                setEditingItem(item); // Fallback to basic data
            } finally {
                setEditLoading(false);
            }
        } else {
            setEditingItem(item);
        }
        setShowFormModal(true);
    }, [getByIdFn, entityName, clearError]);

    const closeForm = useCallback(() => {
        setShowFormModal(false);
        setEditingItem(null);
        clearError();
    }, [clearError]);

    const handleFormSuccess = useCallback(() => {
        const label = entityName.charAt(0).toUpperCase() + entityName.slice(1);
        toast?.success(`${label} saved successfully`);
        closeForm();
        if (onSuccess) onSuccess();
    }, [closeForm, onSuccess, entityName, toast]);

    // Delete modal handlers
    const openDelete = useCallback((item: T) => {
        setDeletingItem(item);
        setShowDeleteModal(true);
        clearError();
    }, [clearError]);

    const closeDelete = useCallback(() => {
        setShowDeleteModal(false);
        setDeletingItem(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deletingItem) return;

        setDeleteLoading(true);
        clearError();
        try {
            await deleteFn(deletingItem.id);
            const label = entityName.charAt(0).toUpperCase() + entityName.slice(1);
            toast?.success(`${label} deleted successfully`);
            closeDelete();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            const raw = err instanceof Error ? err.message : `Failed to delete ${entityName}`;
            const friendly = parseApiError(raw);
            setError(friendly);
            toast?.error(friendly);
        } finally {
            setDeleteLoading(false);
        }
    }, [deletingItem, deleteFn, closeDelete, onSuccess, entityName, clearError, toast]);

    return {
        error,
        setError,
        clearError,
        showFormModal,
        editingItem,
        formLoading,
        editLoading,
        setFormLoading,
        openCreate,
        openEdit,
        closeForm,
        handleFormSuccess,
        showDeleteModal,
        deletingItem,
        deleteLoading,
        openDelete,
        confirmDelete,
        closeDelete,
    };
}

