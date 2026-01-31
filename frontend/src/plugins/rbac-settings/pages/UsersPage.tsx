/**
 * Users Page
 */

import { useState, useEffect } from 'react';
import { usersApi } from '../../../core/api/rbac.api';
import type { User } from '../../../core/types/user.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import './SettingsPage.css';

export function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadUsers();
    }, [page]);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const response = await usersApi.list({ page, limit: 10 });
            setUsers(response.data || []);
            setTotalPages(response.meta?.totalPages || 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.primary_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await usersApi.delete(id);
            loadUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete user');
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Users</h1>
                    <p>Manage user accounts and their access</p>
                </div>
                <button className="btn btn-primary">
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

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
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Roles</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td className="font-medium">{user.username}</td>
                                        <td>{user.first_name} {user.last_name}</td>
                                        <td>{user.primary_email}</td>
                                        <td>
                                            <span className={`status-badge status-${user.status}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td>{user.roles?.map(r => r.name).join(', ') || '-'}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => handleDelete(user.id)}>
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
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                </>
            )}
        </div>
    );
}
