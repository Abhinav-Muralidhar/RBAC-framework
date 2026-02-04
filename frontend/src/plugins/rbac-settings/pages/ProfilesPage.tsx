/**
 * Profiles Page
 * 
 * Manage permission profiles with forms and confirmation modals.
 */

import { profilesApi } from '../../../core/api/rbac.api';
import type { Profile } from '../../../core/types/profile.types';
import { Plus, Edit2, Trash2, Search, Key } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { ProfileForm, submitProfileForm } from '../components/ProfileForm';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

export function ProfilesPage() {
    const crud = useCrudPage<Profile>({
        listFn: profilesApi.list,
        deleteFn: profilesApi.delete,
        entityName: 'profiles',
        initialLimit: 100,
    });

    const filteredProfiles = crud.items.filter(profile =>
        profile.name.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        profile.code.toLowerCase().includes(crud.searchQuery.toLowerCase())
    );

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Profiles</h1>
                    <p>Manage permission profiles</p>
                </div>
                <button className="btn btn-primary" onClick={crud.openCreate}>
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
                <div className="loading-state">Loading profiles...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th className="hide-mobile">Description</th>
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
                                    <td className="hide-mobile">{profile.description || '-'}</td>
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
                                            <button
                                                className="btn-icon"
                                                title="Edit"
                                                onClick={() => crud.openEdit(profile)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Delete"
                                                onClick={() => crud.openDelete(profile)}
                                            >
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

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={crud.showFormModal}
                title={crud.editingItem ? 'Edit Profile' : 'Add New Profile'}
                isLoading={crud.formLoading}
                onSubmit={() => submitProfileForm()}
                onCancel={crud.closeForm}
                size="md"
            >
                <ProfileForm
                    profile={crud.editingItem}
                    onSuccess={crud.handleFormSuccess}
                    onError={crud.setError}
                    setLoading={crud.setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={crud.showDeleteModal}
                title="Delete Profile"
                message="Are you sure you want to delete this profile? Roles using this profile will lose associated permissions."
                itemName={crud.deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={crud.deleteLoading}
                onConfirm={crud.confirmDelete}
                onCancel={crud.closeDelete}
            />
        </div>
    );
}
