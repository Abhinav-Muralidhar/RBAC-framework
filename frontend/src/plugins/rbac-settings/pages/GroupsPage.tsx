/**
 * Groups Page
 *
 * Manage user groups with forms and confirmation modals.
 */

import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { Plus, Edit2, Trash2, Search, Users } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { GroupForm, submitGroupForm } from '../components';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

export function GroupsPage() {
    const crud = useCrudPage<Group>({
        listFn: groupsApi.list,
        deleteFn: groupsApi.delete,
        entityName: 'groups',
        initialLimit: 100,
    });

    const filteredGroups = crud.items.filter(group =>
        group.name.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        (group.code ?? '').toLowerCase().includes(crud.searchQuery.toLowerCase())
    );

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Groups</h1>
                    <p>Manage user groups and their roles</p>
                </div>
                <button className="btn btn-primary" onClick={crud.openCreate}>
                    <Plus size={18} />
                    Add Group
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search groups..."
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
                <div className="loading-state">Loading groups...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th className="hide-mobile">Description</th>
                                <th>Users</th>
                                <th>Roles</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGroups.map(group => (
                                <tr key={group.id}>
                                    <td className="font-medium">{group.name}</td>
                                    <td><code>{group.code || '-'}</code></td>
                                    <td className="hide-mobile">{group.description || '-'}</td>
                                    <td>
                                        <span className="user-count">
                                            <Users size={14} />
                                            {group.user_count || 0}
                                        </span>
                                    </td>
                                    <td>{group.roles?.length || 0}</td>
                                    <td>
                                        <span
                                            className={`status-badge status-${group.is_active ? 'active' : 'inactive'}`}
                                        >
                                            {group.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-icon"
                                                title="Edit"
                                                onClick={() => crud.openEdit(group)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Delete"
                                                onClick={() => crud.openDelete(group)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredGroups.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="empty-state">
                                        No groups found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={crud.showFormModal}
                title={crud.editingItem ? 'Edit Group' : 'Add New Group'}
                isLoading={crud.formLoading}
                onSubmit={() => submitGroupForm()}
                onCancel={crud.closeForm}
                size="md"
            >
                <GroupForm
                    group={crud.editingItem}
                    onSuccess={crud.handleFormSuccess}
                    onError={crud.setError}
                    setLoading={crud.setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={crud.showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? Users in this group may lose associated role permissions."
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
