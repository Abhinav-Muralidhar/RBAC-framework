/**
 * Users Page
 * 
 * Manage user accounts with forms and confirmation modals.
 */

import { usersApi } from '../../../core/api/rbac.api';
import type { User } from '../../../core/types/user.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { UserForm, submitUserForm } from '../components';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

export function UsersPage() {
    const crud = useCrudPage<User>({
        listFn: usersApi.list,
        deleteFn: usersApi.delete,
        entityName: 'users',
    });

    const filteredUsers = crud.items.filter(user =>
        user.username.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        user.primary_email.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(crud.searchQuery.toLowerCase())
    );

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Users</h1>
                    <p>Manage user accounts and their access</p>
                </div>
                <button className="btn btn-primary" onClick={crud.openCreate}>
                    <Plus size={18} />
                    Add User
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
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
                <div className="loading-state">Loading users...</div>
            ) : (
                <>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Name</th>
                                    <th className="hide-mobile">Email</th>
                                    <th>Status</th>
                                    <th className="hide-mobile">Roles</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td className="font-medium">{user.username}</td>
                                        <td>{user.first_name} {user.last_name}</td>
                                        <td className="hide-mobile">{user.primary_email}</td>
                                        <td>
                                            <span className={`status-badge status-${user.status.toLowerCase()}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="hide-mobile">{user.rolesname}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon"
                                                    title="Edit"
                                                    onClick={() => crud.openEdit(user)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-danger"
                                                    title="Delete"
                                                    onClick={() => crud.openDelete(user)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="empty-state">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button disabled={crud.page <= 1} onClick={crud.prevPage}>Previous</button>
                        <span>Page {crud.page} of {crud.totalPages}</span>
                        <button disabled={crud.page >= crud.totalPages} onClick={crud.nextPage}>Next</button>
                    </div>

                </>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={crud.showFormModal}
                title={crud.editingItem ? 'Edit User' : 'Add New User'}
                isLoading={crud.formLoading}
                onSubmit={() => submitUserForm()}
                onCancel={crud.closeForm}
                size="md"
            >
                <UserForm
                    user={crud.editingItem}
                    onSuccess={crud.handleFormSuccess}
                    onError={crud.setError}
                    setLoading={crud.setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={crud.showDeleteModal}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
                itemName={crud.deletingItem?.username}
                confirmLabel="Delete"
                variant="danger"
                isLoading={crud.deleteLoading}
                onConfirm={crud.confirmDelete}
                onCancel={crud.closeDelete}
            />
        </div>
    );
}
