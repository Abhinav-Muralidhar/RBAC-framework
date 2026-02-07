/**
 * Roles Page
 * 
 * Manage user roles with forms and confirmation modals.
 */

import { rolesApi } from '../../../core/api/rbac.api';
import type { Role } from '../../../core/types/role.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { RoleForm, submitRoleForm } from '../components';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

export function RolesPage() {
    const crud = useCrudPage<Role>({
        listFn: rolesApi.list,
        deleteFn: rolesApi.delete,
        entityName: 'roles',
        initialLimit: 100,
    });

    const filteredRoles = crud.items.filter(role =>
        role.name.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        role.code.toLowerCase().includes(crud.searchQuery.toLowerCase())
    );

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Roles</h1>
                    <p>Manage user roles and hierarchies</p>
                </div>
                <button className="btn btn-primary" onClick={crud.openCreate}>
                    <Plus size={18} />
                    Add Role
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search roles..."
                        value={crud.searchQuery}
                        onChange={(e) => crud.setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {crud.error && (
                <div className="error-banner">
                    {crud.error}
                    <button onClick={crud.clearError}>×</button>
                </div>
            )}

            {crud.isLoading ? (
                <div className="loading-state">Loading roles...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th className="hide-mobile">Description</th>
                                <th className="hide-mobile">Profiles</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoles.map(role => (
                                <tr key={role.id}>
                                    <td className="font-medium">{role.name}</td>
                                    <td><code>{role.code}</code></td>
                                    <td className="hide-mobile">{role.description || '-'}</td>
                                    <td className="hide-mobile">{role.profiles?.length || 0}</td>
                                    <td>
                                        <span className={`status-badge status-${role.is_active ? 'active' : 'inactive'}`}>
                                            {role.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-icon"
                                                title="Edit"
                                                onClick={() => crud.openEdit(role)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Delete"
                                                onClick={() => crud.openDelete(role)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRoles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="empty-state">No roles found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={crud.showFormModal}
                title={crud.editingItem ? 'Edit Role' : 'Add New Role'}
                isLoading={crud.formLoading}
                onSubmit={() => submitRoleForm()}
                onCancel={crud.closeForm}
                size="md"
            >
                <RoleForm
                    role={crud.editingItem}
                    onSuccess={crud.handleFormSuccess}
                    onError={crud.setError}
                    setLoading={crud.setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={crud.showDeleteModal}
                title="Delete Role"
                message="Are you sure you want to delete this role? Users assigned this role will lose associated permissions."
                itemName={crud.deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={crud.deleteLoading}
                onConfirm={crud.confirmDelete}
                onCancel={crud.closeDelete}
            />
        </div>
    );
}
