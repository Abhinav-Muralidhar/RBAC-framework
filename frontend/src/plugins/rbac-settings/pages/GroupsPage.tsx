/**
 * Groups Page
 *
 * Manage user groups using centralized hooks for pagination and CRUD.
 */

import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import { useToast } from '../../../core/contexts/ToastContext';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { GroupForm, submitGroupForm } from '../components';
import './SettingsPage.css';

export function GroupsPage() {
    const toast = useToast();
    const {
        data: groups,
        isLoading,
        error: listError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        setPage,
        reload,
        filters,
        setFilters
    } = usePaginatedData<Group>(groupsApi.list, { initialLimit: 100 });

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
    } = useCrud<Group>({
        deleteFn: groupsApi.delete,
        getByIdFn: groupsApi.getById,
        entityName: 'groups',
        onSuccess: reload,
        toast,
    });

    const [showFilterModal, setShowFilterModal] = useState(false);
    const detailsModal = useDetailsModal();

    const groupFields = useMemo<FieldConfig<Group>[]>(() => [
        { label: 'Name', key: 'name' },
        { label: 'Code', key: 'code' },
        { label: 'Description', key: 'description' },
        {
            label: 'Status', key: 'is_active', render: (v: boolean) => (
                <span className={`status-badge status-${v ? 'active' : 'inactive'}`}>{v ? 'Active' : 'Inactive'}</span>
            )
        },
        { label: 'User Count', key: 'user_count' },
        {
            label: 'Roles', key: 'roles', render: (v: any) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((r: any) => r.name).join(', ');
            }
        },
        {
            label: 'Users', key: 'users', render: (v: any) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((u: any) => u.name).join(', ');
            }
        },
        { label: 'Created At', key: 'created_at', render: (v: any) => v ? new Date(v).toLocaleString() : '—' },
        { label: 'Created By', key: 'created_by_name' },
    ], []);

    const error = listError || crudError;


    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Groups</h1>
                    <p>Manage user groups and their roles</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Group
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    className={`btn ${Object.keys(filters).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilterModal(true)}
                >
                    <Filter size={18} /> Filter
                    {Object.keys(filters).length > 0 && <span className="badge">{Object.keys(filters).length}</span>}
                </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading groups...</div>
            ) : (
                <>
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
                                {groups.length > 0 ? groups.map(group => (
                                    <tr key={group.id}>
                                        <td data-label="Name" className="clickable-cell" onClick={() => detailsModal.open(group.id)}>{group.name}</td>
                                        <td data-label="Code" className="clickable-cell" onClick={() => detailsModal.open(group.id)}><code>{group.code || '-'}</code></td>
                                        <td data-label="Description" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(group.id)}>{group.description || '-'}</td>
                                        <td data-label="Status" className="clickable-cell" onClick={() => detailsModal.open(group.id)}>
                                            <span className={`status-badge status-${group.is_active ? 'active' : 'inactive'}`}>
                                                {group.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td data-label="Actions">
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={() => openEdit(group)} disabled={editLoading}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(group)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No groups found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={showFormModal}
                title={editingItem ? 'Edit Group' : 'Add New Group'}
                isLoading={false}
                onSubmit={() => submitGroupForm()}
                onCancel={closeForm}
                size="md"
            >
                <GroupForm
                    group={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={(err) => toast.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? Users in this group may lose associated role permissions."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />

            {/* Filter Modal Placeholder */}
            <FormModal
                isOpen={showFilterModal}
                title="Filter Groups"
                onSubmit={() => setShowFilterModal(false)}
                onCancel={() => setShowFilterModal(false)}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                            onChange={(e) => setFilters({
                                ...filters,
                                isActive: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    {Object.keys(filters).length > 0 && (
                        <button
                            className="btn btn-text filter-clear"
                            onClick={() => {
                                setFilters({});
                                setShowFilterModal(false);
                            }}
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            </FormModal>

            {/* Details Modal */}
            <DetailsModal<Group>
                isOpen={detailsModal.isOpen}
                title="Group Details"
                entityId={detailsModal.selectedId}
                fetchFn={groupsApi.getById}
                fields={groupFields}
                onClose={detailsModal.close}
                size="md"
            />
        </div>
    );
}
