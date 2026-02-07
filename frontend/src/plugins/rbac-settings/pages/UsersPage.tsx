/**
 * Users Page
 *
 * Manage user accounts with forms and confirmation modals.
 */

import { useState } from 'react';
import { usersApi } from '../../../core/api/rbac.api';
import type { User } from '../../../core/types/user.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { UserForm, submitUserForm } from '../components';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function UsersPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const {
        data: users,
        isLoading,
        error,
        page,
        totalPages,
        setPage,
        reload,
    } = usePaginatedData<User>(usersApi.list, 20);

    const filteredUsers = (users || []).filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.primary_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openCreate = () => {
        setEditingUser(null);
        setShowFormModal(true);
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setShowFormModal(true);
    };

    const openDelete = (user: User) => {
        setDeletingUser(user);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deletingUser) return;
        await usersApi.delete(deletingUser.id);
        setShowDeleteModal(false);
        reload();
    };

    return (
        <div className="settings-page">
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
            </div>

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
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
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map(user => (
                                        <tr key={user.id}>
                                            <td className="font-medium">{user.username}</td>
                                            <td>{user.first_name} {user.last_name}</td>
                                            <td className="hide-mobile">{user.primary_email}</td>
                                            <td>
                                                <span className={`status-badge status-${user.status.toLowerCase()}`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        title="Edit"
                                                        onClick={() => openEdit(user)}
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
                                        <td colSpan={6} className="empty-state">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination (always visible, disabled when needed) */}
                    <div className="pagination">
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
                title={editingUser ? 'Edit User' : 'Add New User'}
                isLoading={false}
                onSubmit={() => submitUserForm()}
                onCancel={() => setShowFormModal(false)}
                size="md"
            >
                <UserForm
                    user={editingUser}
                    onSuccess={() => {
                        setShowFormModal(false);
                        reload();
                    }}
                    onError={console.error}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
                itemName={deletingUser?.username}
                confirmLabel="Delete"
                variant="danger"
                isLoading={false}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
