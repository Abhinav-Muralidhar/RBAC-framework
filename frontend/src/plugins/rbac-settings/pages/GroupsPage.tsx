/**
 * Groups Page
 */

import { useState, useEffect } from 'react';
import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { Plus, Edit2, Trash2, Search, Users } from 'lucide-react';
import './SettingsPage.css';

export function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

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
        group.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        try {
            await groupsApi.delete(id);
            loadGroups();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete group');
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Groups</h1>
                    <p>Manage user groups and their roles</p>
                </div>
                <button className="btn btn-primary">
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

            {error && <div className="error-message">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading groups...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Description</th>
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
                                    <td><code>{group.code}</code></td>
                                    <td>{group.description || '-'}</td>
                                    <td>
                                        <span className="user-count">
                                            <Users size={14} />
                                            {group.user_count || 0}
                                        </span>
                                    </td>
                                    <td>{group.roles?.length || 0}</td>
                                    <td>
                                        <span className={`status-badge status-${group.is_active ? 'active' : 'inactive'}`}>
                                            {group.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon btn-danger" title="Delete" onClick={() => handleDelete(group.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredGroups.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="empty-state">No groups found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
