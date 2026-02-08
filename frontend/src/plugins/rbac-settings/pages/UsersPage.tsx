/**
 * Users Page
 *
 * Manage user accounts using centralized CRUD page hook.
 */

import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { usersApi } from '../../../core/api/rbac.api';
import type { User } from '../../../core/types/user.types';
import { useCrudPage } from '../../../core/hooks';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { UserForm, submitUserForm } from '../components';
import './SettingsPage.css';

export function UsersPage() {
    const {
        items: users,
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
    } = useCrudPage<User>({
        listFn: usersApi.list,
        deleteFn: usersApi.delete,
        entityName: 'users',
        initialLimit: 20,
    });

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
                                {users.length > 0 ? (
                                    users.map(user => (
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
                                        <td colSpan={5} className="empty-state">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

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
                title={editingItem ? 'Edit User' : 'Add New User'}
                isLoading={false}
                onSubmit={() => submitUserForm()}
                onCancel={closeForm}
                size="md"
            >
                <UserForm
                    user={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={console.error}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
                itemName={deletingItem?.username}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />
        </div>
    );
}
