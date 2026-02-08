/**
 * Core Hooks Index
 * 
 * Export all hooks from centralized location.
 */

export { useForm } from './useForm';
export type { UseFormOptions, UseFormReturn, ValidationFn } from './useForm';

export { useAsync, useAsyncCallback } from './useAsync';
export type { UseAsyncReturn, UseAsyncCallbackReturn } from './useAsync';

export { useModal } from './useModal';
export type { UseModalReturn } from './useModal';

export { useSidebar } from './useSidebar';
export type { UseSidebarReturn } from './useSidebar';

export { useCrudPage } from './useCrudPage';
export type { UseCrudPageOptions, UseCrudPageReturn, ListParams, ListResponse } from './useCrudPage';

export { usePaginatedData } from './usePaginatedData';
export type { UsePaginatedDataResult, PaginationParams } from './usePaginatedData';

export { useSearch } from './useSearch';
export type { UseSearchReturn } from './useSearch';

export { usePermission } from './usePermission';
export type { UsePermissionReturn } from './usePermission';
