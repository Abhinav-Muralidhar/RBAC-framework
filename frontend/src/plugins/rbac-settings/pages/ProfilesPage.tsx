/**
 * Profiles Page
 */

import { useState, useEffect } from 'react';
import { profilesApi } from '../../../core/api/rbac.api';
import type { Profile } from '../../../core/types/profile.types';
import { Plus, Edit2, Trash2, Search, Key } from 'lucide-react';
import './SettingsPage.css';
import { FormModal } from '../../../core/components/FormModal';
import { ProfileForm, submitProfileForm } from '../components/ProfileForm';

export function ProfilesPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    // Add these lines in ProfilesPage component
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [formLoading, setFormLoading] = useState(false);


    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setIsLoading(true);
            const response = await profilesApi.list({ limit: 100 });
            setProfiles(response.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load profiles');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProfiles = profiles.filter(profile =>
        profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreate = () => {
        setEditingProfile(null);
        setShowFormModal(true);
    };

    const handleEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setEditingProfile(null);
        loadProfiles();
    };

    const handleFormError = (err: string) => {
        setError(err);
    };


    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;
        try {
            await profilesApi.delete(id);
            loadProfiles();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete profile');
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Profiles</h1>
                    <p>Manage permission profiles</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    <Plus size={18} />
                    Add Profile
                </button>

            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search profiles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading profiles...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th>Permissions</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfiles.map(profile => (
                                <tr key={profile.id}>
                                    <td className="font-medium">{profile.name}</td>
                                    <td><code>{profile.code}</code></td>
                                    <td>{profile.description || '-'}</td>
                                    <td>
                                        <span className="permission-count">
                                            <Key size={14} />
                                            {profile.permissions?.length || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge status-${profile.is_active ? 'active' : 'inactive'}`}>
                                            {profile.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" title="Edit" onClick={() => handleEdit(profile)}>
                                                <Edit2 size={16} />
                                            </button>

                                            <button className="btn-icon btn-danger" title="Delete" onClick={() => handleDelete(profile.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="empty-state">No profiles found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <FormModal
                isOpen={showFormModal}
                title={editingProfile ? 'Edit Profile' : 'Add New Profile'}
                isLoading={formLoading}
                onSubmit={() => submitProfileForm()} // replace with actual submit function
                onCancel={() => {
                    setShowFormModal(false);
                    setEditingProfile(null);
                }}
                size="md"
            >
                <ProfileForm
                    profile={editingProfile}
                    onSuccess={handleFormSuccess}
                    onError={handleFormError}
                    setLoading={setFormLoading}
                />
            </FormModal>

        </div>
    );
}
