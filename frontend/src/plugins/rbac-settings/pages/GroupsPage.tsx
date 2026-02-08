/**
 * Groups Page
 *
 * Manage user groups using centralized CRUD page hook.
 */

import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { useCrudPage } from '../../../core/hooks';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { GroupForm, submitGroupForm } from '../components';
import './SettingsPage.css';

export function GroupsPage() {
    const {
        items: groups,
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
    } = useCrudPage<Group>({
        listFn: groupsApi.list,
        deleteFn: groupsApi.delete,
        entityName: 'groups',
        initialLimit: 100,
    });

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Groups</h1>
                    <p>Manage user groups and their roles</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Group
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

            {error && <div className="error-banner">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading groups...</div>
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
                                {groups.length > 0 ? groups.map(group => (
                                    <tr key={group.id}>
                                        <td className="font-medium">{group.name}</td>
                                        <td><code>{group.code || '-'}</code></td>
                                        <td className="hide-mobile">{group.description || '-'}</td>
                                        <td>
                                            <span className={`status-badge status-${group.is_active ? 'active' : 'inactive'}`}>
                                                {group.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={() => openEdit(group)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(group)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No groups found</td>
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
                title={editingItem ? 'Edit Group' : 'Add New Group'}
                isLoading={false}
                onSubmit={() => submitGroupForm()}
                onCancel={closeForm}
                size="md"
            >
                <GroupForm
                    group={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? Users in this group may lose associated role permissions."
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
