/**
 * Profiles Page
 *
 * Manage permission profiles using centralized CRUD page hook.
 */

import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { profilesApi } from '../../../core/api/rbac.api';
import type { Profile } from '../../../core/types/profile.types';
import { useCrudPage } from '../../../core/hooks';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { ProfileForm, submitProfileForm } from '../components/ProfileForm';
import './SettingsPage.css';

export function ProfilesPage() {
    const {
        items: profiles,
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
    } = useCrudPage<Profile>({
        listFn: profilesApi.list,
        deleteFn: profilesApi.delete,
        entityName: 'profiles',
        initialLimit: 100,
    });

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
                                {profiles.length > 0 ? profiles.map(profile => (
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
                                        <td colSpan={5} className="empty-state">No profiles found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

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
                title={editingItem ? 'Edit Profile' : 'Add New Profile'}
                isLoading={false}
                onSubmit={() => submitProfileForm()}
                onCancel={closeForm}
                size="md"
            >
                <ProfileForm
                    profile={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Profile"
                message="Are you sure you want to delete this profile? Roles using this profile will lose associated permissions."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />
        </div>
    );
}
