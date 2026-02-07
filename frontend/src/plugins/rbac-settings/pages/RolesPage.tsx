import { useState } from 'react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role } from '../../../core/types/role.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { RoleForm, submitRoleForm } from '../components';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function RolesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingRole, setDeletingRole] = useState<Role | null>(null);

    const {
        data: roles,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        setPage,
        reload,
    } = usePaginatedData<Role>(rolesApi.list, 100);

    const filteredRoles = (roles || []).filter(role =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openEdit = (role: Role) => {
        setEditingRole(role);
        setShowFormModal(true);
    };

    const openCreate = () => {
        setEditingRole(null);
        setShowFormModal(true);
    };

    const openDelete = (role: Role) => {
        setDeletingRole(role);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deletingRole) return;
        try {
            await rolesApi.delete(deletingRole.id);
            setShowDeleteModal(false);
            reload();
        } catch (err) {
            console.error(err);
        }
    };

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
                                {filteredRoles.length > 0 ? filteredRoles.map(role => (
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
                                        <td colSpan={6} className="empty-state">No roles found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
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
                title={editingRole ? 'Edit Role' : 'Add New Role'}
                isLoading={false}
                onSubmit={() => submitRoleForm()}
                onCancel={() => setShowFormModal(false)}
                size="md"
            >
                <RoleForm
                    role={editingRole}
                    onSuccess={() => { setShowFormModal(false); reload(); }}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
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
                isLoading={false}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
