/**
 * Groups Page
 *
 * Manage user groups with forms and confirmation modals.
 */

import { useState, useEffect } from 'react';
import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { Plus, Edit2, Trash2, Search, Users } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { GroupForm, submitGroupForm } from '../components';
import './SettingsPage.css';

export function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setIsLoading(true);
            const response = await groupsApi.list({ limit: 100 });
            setGroups(response.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load groups');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredGroups = groups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.code ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreate = () => {
        setEditingGroup(null);
        setShowFormModal(true);
    };

    const handleEdit = (group: Group) => {
        setEditingGroup(group);
        setShowFormModal(true);
    };

    const handleDelete = (group: Group) => {
        setDeletingGroup(group);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deletingGroup) return;

        setDeleteLoading(true);
        try {
            await groupsApi.delete(deletingGroup.id);
            setShowDeleteModal(false);
            setDeletingGroup(null);
            loadGroups();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete group');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setEditingGroup(null);
        loadGroups();
    };

    const handleFormError = (err: string) => {
        setError(err);
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Groups</h1>
                    <p>Manage user groups and their roles</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {isLoading ? (
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
                                                onClick={() => handleEdit(group)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Delete"
                                                onClick={() => handleDelete(group)}
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
                isOpen={showFormModal}
                title={editingGroup ? 'Edit Group' : 'Add New Group'}
                isLoading={formLoading}
                onSubmit={() => submitGroupForm()}
                onCancel={() => {
                    setShowFormModal(false);
                    setEditingGroup(null);
                }}
                size="md"
            >
                <GroupForm
                    group={editingGroup}
                    onSuccess={handleFormSuccess}
                    onError={handleFormError}
                    setLoading={setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? Users in this group may lose associated role permissions."
                itemName={deletingGroup?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeletingGroup(null);
                }}
            />
        </div>
    );
}
