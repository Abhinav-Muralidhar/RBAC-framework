/**
 * Profiles Page
 *
 * Manage permission profiles using centralized hooks for pagination and CRUD.
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { profilesApi } from '../../../core/api/rbac.api';
import type { Profile } from '../../../core/types/profile.types';
import { createPaginatedSource, usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import { useToast } from '../../../core/contexts/useToast';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { RbacFormSkeleton, RbacPageSkeleton } from '../components/RbacPageSkeleton';
import type { RbacFormHandle } from '../components';
import './SettingsPage.css';

const ProfileForm = lazy(() => import('../components/ProfileForm').then((module) => ({ default: module.ProfileForm })));

export function ProfilesPage() {
    const toast = useToast();
    const formRef = useRef<RbacFormHandle>(null);
    const {
        data: profiles,
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
    } = usePaginatedData<Profile>(createPaginatedSource('profiles', profilesApi.list));

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
    } = useCrud<Profile>({
        deleteFn: profilesApi.delete,
        getByIdFn: profilesApi.getById,
        entityName: 'profiles',
        onSuccess: reload,
        toast,
    });

    const detailsModal = useDetailsModal();

    const profileFields = useMemo<FieldConfig<Profile>[]>(() => [
        { label: 'Name', key: 'name' },
        { label: 'Code', key: 'code' },
        { label: 'Description', key: 'description' },
        {
            label: 'Status', key: 'is_active', render: (v: unknown) => (
                <span className={`status-badge status-${v ? 'active' : 'inactive'}`}>{v ? 'Active' : 'Inactive'}</span>
            )
        },
        { label: 'Role Count', key: 'role_count' },
        {
            label: 'Permissions', key: 'permissions', render: (v: unknown) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((p: { module_name: string; action: string; effect: string }) => `${p.module_name}: ${p.action} (${p.effect})`).join(', ');
            }
        },
        { label: 'Created At', key: 'created_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Created By', key: 'created_by_name' },
        { label: 'Updated At', key: 'updated_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Updated By', key: 'updated_by_name' },
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
                            <h1>Profiles</h1>
                            <p>Manage permission profiles</p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreate}>
                            <Plus size={18} /> Add Profile
                        </button>
                    </header>

                    <div className="page-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search profiles..."
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
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th className="hide-mobile">Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.length > 0 ? profiles.map(profile => (
                                    <tr key={profile.id}>
                                        <td data-label="Name" className="clickable-cell" onClick={() => detailsModal.open(profile.id)}>{profile.name}</td>
                                        <td data-label="Code" className="clickable-cell" onClick={() => detailsModal.open(profile.id)}><code>{profile.code}</code></td>
                                        <td data-label="Description" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(profile.id)}>{profile.description || '-'}</td>
                                        <td data-label="Status" className="clickable-cell" onClick={() => detailsModal.open(profile.id)}>
                                            <span className={`status-badge status-${profile.is_active ? 'active' : 'inactive'}`}>
                                                {profile.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td data-label="Actions">
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={() => openEdit(profile)} disabled={editLoading}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(profile)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No profiles found</td>
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
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={showFormModal}
                title={editingItem ? 'Edit Profile' : 'Add New Profile'}
                isLoading={false}
                onSubmit={() => formRef.current?.submit()}
                onCancel={closeForm}
                size="md"
            >
                <Suspense fallback={<RbacFormSkeleton />}>
                    <ProfileForm
                        ref={formRef}
                        profile={editingItem}
                        onSuccess={handleFormSuccess}
                        onError={(err) => toast.error(err)}
                        setLoading={() => { }}
                    />
                </Suspense>
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Profile"
                message="Are you sure you want to delete this profile? Roles using this profile will lose associated permissions."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />

            {/* Filter Modal Placeholder */}
            <FormModal
                isOpen={filterModal.isOpen}
                title="Filter Profiles"
                onSubmit={filterModal.submit}
                onCancel={filterModal.close}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={draftFilters.is_active === undefined ? '' : draftFilters.is_active.toString()}
                            onChange={(e) => setDraftFilters({
                                ...draftFilters,
                                is_active: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
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
            <DetailsModal<Profile>
                isOpen={detailsModal.isOpen}
                title="Profile Details"
                entityId={detailsModal.selectedId}
                fetchFn={profilesApi.getById}
                fields={profileFields}
                onClose={detailsModal.close}
                size="md"
            />
        </div>
    );
}
