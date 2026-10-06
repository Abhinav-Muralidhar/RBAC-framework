/**
 * Users Page
 *
 * Manage user accounts using centralized hooks for pagination and CRUD.
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { usersApi } from '../../../core/api/rbac.api';
import { formatUserName } from '../../../core/constants/userPreferences';
import type { User } from '../../../core/types/user.types';
import { createPaginatedSource, usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import { useToast } from '../../../core/contexts/useToast';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { RbacFormSkeleton, RbacPageSkeleton } from '../components/RbacPageSkeleton';
import type { RbacFormHandle } from '../components';
import './SettingsPage.css';

const UserForm = lazy(() => import('../components/UserForm').then((module) => ({ default: module.UserForm })));

export function UsersPage() {
    const toast = useToast();
    const formRef = useRef<RbacFormHandle>(null);
    const {
        data: users,
        isInitialLoading,
        error: listError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        limit,
        limitOptions,
        setPage,
        setLimit,
        reload,
        filters,
        draftFilters,
        setDraftFilters,
        filterModal
    } = usePaginatedData<User>(createPaginatedSource('users', usersApi.list));

    const {
        showFormModal,
        editingItem,
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
        editLoading,
        error: crudError,
    } = useCrud<User>({
        deleteFn: usersApi.delete,
        getByIdFn: usersApi.getById,
        entityName: 'users',
        onSuccess: reload,
        toast,
    });

    const detailsModal = useDetailsModal();

    const userFields = useMemo<FieldConfig<User>[]>(() => [
        { label: 'Username', key: 'username' },
        { label: 'First Name', key: 'first_name' },
        { label: 'Last Name', key: 'last_name' },
        { label: 'Title', key: 'title' },
        { label: 'Department', key: 'department' },
        {
            label: 'Status', key: 'status', render: (v: unknown) => (
                <span className={`status-badge status-${(v as string)?.toLowerCase()}`}>{v as string}</span>
            )
        },
        { label: 'Role', key: 'rolesname' },
        { label: 'Primary Email', key: 'primary_email' },
        { label: 'Secondary Email', key: 'secondary_email' },
        { label: 'Other Email', key: 'other_email' },
        { label: 'Office Phone', key: 'office_phone' },
        { label: 'Mobile Phone', key: 'mobile_phone' },
        { label: 'Home Phone', key: 'home_phone' },
        { label: 'Street', key: 'street' },
        { label: 'City', key: 'city' },
        { label: 'State', key: 'state' },
        { label: 'Country', key: 'country' },
        { label: 'Postal Code', key: 'postal_code' },
        { label: 'Time Zone', key: 'time_zone' },
        {
            label: 'Groups', key: 'groups', render: (v: unknown) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((g: { name: string }) => g.name).join(', ');
            }
        },
        { label: 'Created At', key: 'created_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Created By', key: 'created_by_name' },
        { label: 'Updated At', key: 'updated_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Updated By', key: 'updated_by_name' },
        { label: 'Last Login', key: 'last_login_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
    ], []);

    const error = listError || crudError;

    return (
        <div className="settings-page">
            {isInitialLoading ? (
                <RbacPageSkeleton columns={5} rows={4} />
            ) : (
                <>
                    <header className="page-header">
                        <div>
                            <h1>Users</h1>
                            <p>Manage user accounts and their access</p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreate}>
                            <Plus size={18} /> Add User
                        </button>
                    </header>

                    <div className="page-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button
                            className={`btn ${Object.keys(filters).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={filterModal.open}
                        >
                            <Filter size={18} /> Filter
                            {Object.keys(filters).length > 0 && <span className="badge">{Object.keys(filters).length}</span>}
                        </button>
                    </div>

                    {error && <div className="error-banner">{error}</div>}

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Name</th>
                                    <th className="hide-mobile">Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users.map(user => (
                                        <tr key={user.id}>
                                            <td data-label="Username" className="clickable-cell" onClick={() => detailsModal.open(user.id)}>{user.username}</td>
                                            <td data-label="Name" className="clickable-cell" onClick={() => detailsModal.open(user.id)}>{formatUserName(user.first_name, user.last_name, user.name_format)}</td>
                                            <td data-label="Email" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(user.id)}>{user.primary_email}</td>
                                            <td data-label="Status" className="clickable-cell" onClick={() => detailsModal.open(user.id)}>
                                                <span className={`status-badge status-${user.status.toLowerCase()}`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td data-label="Actions">
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        title="Edit"
                                                        onClick={() => openEdit(user)}
                                                        disabled={editLoading}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-danger"
                                                        title="Delete"
                                                        onClick={() => openDelete(user)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <div className="page-size">
                            <label className="form-label">Rows</label>
                            <select
                                className="form-control"
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                            >
                                {limitOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            {/* Create / Edit Modal */}
            <FormModal
                isOpen={showFormModal}
                title={editingItem ? 'Edit User' : 'Add New User'}
                isLoading={false}
                onSubmit={() => formRef.current?.submit()}
                onCancel={closeForm}
                size="md"
            >
                <Suspense fallback={<RbacFormSkeleton />}>
                    <UserForm
                        ref={formRef}
                        user={editingItem}
                        onSuccess={handleFormSuccess}
                        onError={(err) => toast.error(err)}
                        setLoading={() => { }}
                    />
                </Suspense>
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
                itemName={deletingItem?.username}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />

            {/* Filter Modal Placeholder */}
            <FormModal
                isOpen={filterModal.isOpen}
                title="Filter Users"
                onSubmit={filterModal.submit}
                onCancel={filterModal.close}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={(draftFilters.status as string) || ''}
                            onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value || undefined })}
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="deleted">Deleted</option>
                        </select>
                    </div>
                    {Object.keys(draftFilters).length > 0 && (
                        <button
                            className="btn btn-text filter-clear"
                            onClick={() => {
                                setDraftFilters({});
                            }}
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            </FormModal>

            {/* Details Modal */}
            <DetailsModal<User>
                isOpen={detailsModal.isOpen}
                title="User Details"
                entityId={detailsModal.selectedId}
                fetchFn={usersApi.getById}
                fields={userFields}
                onClose={detailsModal.close}
                size="lg"
            />
        </div>
    );
}
