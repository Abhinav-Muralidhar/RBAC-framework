/**
 * Roles Page
 *
 * Manage user roles using centralized CRUD page hook.
 */

import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role } from '../../../core/types/role.types';
import { useCrudPage } from '../../../core/hooks';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { RoleForm, submitRoleForm } from '../components';
import './SettingsPage.css';

export function RolesPage() {
    const {
        items: roles,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        setPage,
        reload,
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
    } = useCrudPage<Role>({
        listFn: rolesApi.list,
        deleteFn: rolesApi.delete,
        entityName: 'roles',
        initialLimit: 100,
    });

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Roles</h1>
                    <p>Manage user roles and hierarchies</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Role
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search roles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading roles...</div>
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
                                {roles.length > 0 ? roles.map(role => (
                                    <tr key={role.id}>
                                        <td className="font-medium">{role.name}</td>
                                        <td><code>{role.code}</code></td>
                                        <td className="hide-mobile">{role.description || '-'}</td>
                                        <td>
                                            <span className={`status-badge status-${role.is_active ? 'active' : 'inactive'}`}>
                                                {role.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={() => openEdit(role)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(role)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No roles found</td>
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
                title={editingItem ? 'Edit Role' : 'Add New Role'}
                isLoading={false}
                onSubmit={() => submitRoleForm()}
                onCancel={closeForm}
                size="md"
            >
                <RoleForm
                    role={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Role"
                message="Are you sure you want to delete this role? Users assigned this role will lose associated permissions."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />
        </div>
    );
}
