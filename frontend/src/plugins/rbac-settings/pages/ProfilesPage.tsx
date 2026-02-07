import { useState } from 'react';
import { profilesApi } from '../../../core/api/rbac.api';
import type { Profile } from '../../../core/types/profile.types';
import { Plus, Edit2, Trash2, Search, Key } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { ProfileForm, submitProfileForm } from '../components/ProfileForm';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function ProfilesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);

    const {
        data: profiles,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        setPage,
        reload
    } = usePaginatedData<Profile>(profilesApi.list, 100);

    const filteredProfiles = (profiles || []).filter(profile =>
        profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setShowFormModal(true);
    };

    const openCreate = () => {
        setEditingProfile(null);
        setShowFormModal(true);
    };

    const openDelete = (profile: Profile) => {
        setDeletingProfile(profile);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deletingProfile) return;
        try {
            await profilesApi.delete(deletingProfile.id);
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
                    <h1>Profiles</h1>
                    <p>Manage permission profiles</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Profile
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

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading profiles...</div>
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
                                {filteredProfiles.length > 0 ? filteredProfiles.map(profile => (
                                    <tr key={profile.id}>
                                        <td className="font-medium">{profile.name}</td>
                                        <td><code>{profile.code}</code></td>
                                        <td className="hide-mobile">{profile.description || '-'}</td>
                                        <td>
                                            <span className={`status-badge status-${profile.is_active ? 'active' : 'inactive'}`}>
                                                {profile.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={() => openEdit(profile)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(profile)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="empty-state">No profiles found</td>
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
                title={editingProfile ? 'Edit Profile' : 'Add New Profile'}
                isLoading={false}
                onSubmit={() => submitProfileForm()}
                onCancel={() => setShowFormModal(false)}
                size="md"
            >
                <ProfileForm
                    profile={editingProfile}
                    onSuccess={() => { setShowFormModal(false); reload(); }}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Profile"
                message="Are you sure you want to delete this profile? Roles using this profile will lose associated permissions."
                itemName={deletingProfile?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={false}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
