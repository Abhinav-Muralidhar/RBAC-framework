/**
 * Roles Page
 */

import { useState, useEffect } from 'react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role } from '../../../core/types/role.types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import './SettingsPage.css';

export function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return;
        try {
            await rolesApi.delete(id);
            loadRoles();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete role');
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Roles</h1>
                    <p>Manage user roles and hierarchies</p>
                </div>
                <button className="btn btn-primary">
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

            {error && <div className="error-message">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading roles...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th>Profiles</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoles.map(role => (
                                <tr key={role.id}>
                                    <td className="font-medium">{role.name}</td>
                                    <td><code>{role.code}</code></td>
                                    <td>{role.description || '-'}</td>
                                    <td>{role.profiles?.length || 0}</td>
                                    <td>
                                        <span className={`status-badge status-${role.is_active ? 'active' : 'inactive'}`}>
                                            {role.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon btn-danger" title="Delete" onClick={() => handleDelete(role.id)}>
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
        </div>
    );
}
