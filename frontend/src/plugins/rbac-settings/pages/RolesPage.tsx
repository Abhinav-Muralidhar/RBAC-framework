/**
 * Roles Page
 * 
 * Manage user roles with forms and confirmation modals.
 */

import { useState, useEffect } from 'react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role } from '../../../core/types/role.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { RoleForm, submitRoleForm } from '../components';
import './SettingsPage.css';

export function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingRole, setDeletingRole] = useState<Role | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            setIsLoading(true);
            const response = await rolesApi.list({ limit: 100 });
            setRoles(response.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load roles');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreate = () => {
        setEditingRole(null);
        setShowFormModal(true);
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setShowFormModal(true);
    };

    const handleDelete = (role: Role) => {
        setDeletingRole(role);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deletingRole) return;

        setDeleteLoading(true);
        try {
            await rolesApi.delete(deletingRole.id);
            setShowDeleteModal(false);
            setDeletingRole(null);
            loadRoles();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete role');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setEditingRole(null);
        loadRoles();
    };

    const handleFormError = (err: string) => {
        setError(err);
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Roles</h1>
                    <p>Manage user roles and hierarchies</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
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
                                                onClick={() => handleEdit(role)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Delete"
                                                onClick={() => handleDelete(role)}
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
                isOpen={showFormModal}
                title={editingRole ? 'Edit Role' : 'Add New Role'}
                isLoading={formLoading}
                onSubmit={() => submitRoleForm()}
                onCancel={() => {
                    setShowFormModal(false);
                    setEditingRole(null);
                }}
                size="md"
            >
                <RoleForm
                    role={editingRole}
                    onSuccess={handleFormSuccess}
                    onError={handleFormError}
                    setLoading={setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Role"
                message="Are you sure you want to delete this role? Users assigned this role will lose associated permissions."
                itemName={deletingRole?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeletingRole(null);
                }}
            />
        </div>
    );
}
