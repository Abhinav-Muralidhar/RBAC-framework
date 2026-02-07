/**
 * useCrudPage Hook
 * 
 * Encapsulates common CRUD page patterns:
 * - List fetching with pagination and search
 * - Create/Edit modal management
 * - Delete confirmation modal management
 */

import { useState, useEffect, useCallback } from 'react';

export interface ListParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface ListResponse<T> {
    data: T[];
    meta?: {
        totalPages?: number;
        total?: number;
        page?: number;
    };
}

export interface UseCrudPageOptions<T> {
    listFn: (params: ListParams) => Promise<ListResponse<T>>;
    deleteFn: (id: string) => Promise<void>;
    entityName: string;
    initialLimit?: number;
}

export interface UseCrudPageReturn<T> {
    // List state
    items: T[];
    isLoading: boolean;
    error: string | null;
    setError: (error: string) => void;
    clearError: () => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Pagination
    page: number;
    totalPages: number;
    setPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;

    // Reload
    reload: () => Promise<void>;

    // Form modal
    showFormModal: boolean;
    editingItem: T | null;
    formLoading: boolean;
    setFormLoading: (loading: boolean) => void;
    openCreate: () => void;
    openEdit: (item: T) => void;
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

export function useCrudPage<T extends { id: string }>({
    listFn,
    deleteFn,
    entityName,
    initialLimit = 10,
}: UseCrudPageOptions<T>): UseCrudPageReturn<T> {
    // List state
    const [items, setItems] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search & pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Form modal state
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingItem, setDeletingItem] = useState<T | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const loadItems = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await listFn({ page, limit: initialLimit });
            setItems(response.data || []);
            setTotalPages(response.meta?.totalPages || 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to load ${entityName}`);
        } finally {
            setIsLoading(false);
        }
    }, [listFn, page, initialLimit, entityName]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const clearError = useCallback(() => setError(null), []);

    const nextPage = useCallback(() => {
        if (page < totalPages) setPage(p => p + 1);
    }, [page, totalPages]);

    const prevPage = useCallback(() => {
        if (page > 1) setPage(p => p - 1);
    }, [page]);

    // Form modal handlers
    const openCreate = useCallback(() => {
        setEditingItem(null);
        setShowFormModal(true);
    }, []);

    const openEdit = useCallback((item: T) => {
        setEditingItem(item);
        setShowFormModal(true);
    }, []);

    const closeForm = useCallback(() => {
        setShowFormModal(false);
        setEditingItem(null);
    }, []);

    const handleFormSuccess = useCallback(() => {
        closeForm();
        loadItems();
    }, [closeForm, loadItems]);

    // Delete modal handlers
    const openDelete = useCallback((item: T) => {
        setDeletingItem(item);
        setShowDeleteModal(true);
    }, []);

    const closeDelete = useCallback(() => {
        setShowDeleteModal(false);
        setDeletingItem(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deletingItem) return;

        setDeleteLoading(true);
        try {
            await deleteFn(deletingItem.id);
            closeDelete();
            loadItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to delete ${entityName}`);
        } finally {
            setDeleteLoading(false);
        }
    }, [deletingItem, deleteFn, closeDelete, loadItems, entityName]);

    return {
        items,
        isLoading,
        error,
        setError,
        clearError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        setPage,
        nextPage,
        prevPage,
        reload: loadItems,
        showFormModal,
        editingItem,
        formLoading,
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
