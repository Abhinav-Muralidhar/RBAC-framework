import { useState } from 'react';
import { groupsApi } from '../../../core/api/rbac.api';
import type { Group } from '../../../core/types/group.types';
import { Plus, Edit2, Trash2, Search, Users } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { GroupForm, submitGroupForm } from '../components';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function GroupsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

    const {
        data: groups,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        setPage,
        reload
    } = usePaginatedData<Group>(groupsApi.list, 100);

    const filteredGroups = (groups || []).filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.code ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openCreate = () => {
        setEditingGroup(null);
        setShowFormModal(true);
    };

    const openEdit = (group: Group) => {
        setEditingGroup(group);
        setShowFormModal(true);
    };

    const openDelete = (group: Group) => {
        setDeletingGroup(group);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deletingGroup) return;
        try {
            await groupsApi.delete(deletingGroup.id);
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
                                {filteredGroups.length > 0 ? filteredGroups.map(group => (
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
                                        <td colSpan={7} className="empty-state">No groups found</td>
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
                title={editingGroup ? 'Edit Group' : 'Add New Group'}
                isLoading={false}
                onSubmit={() => submitGroupForm()}
                onCancel={() => setShowFormModal(false)}
                size="md"
            >
                <GroupForm
                    group={editingGroup}
                    onSuccess={() => { setShowFormModal(false); reload(); }}
                    onError={(err) => console.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? Users in this group may lose associated role permissions."
                itemName={deletingGroup?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={false}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
