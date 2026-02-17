import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, Search, Filter,
    ChevronRight, ChevronDown, Folder, CornerDownRight,
    User, Building2
} from 'lucide-react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role, RoleNode } from '../../../core/types/role.types';
import { usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import { useToast } from '../../../core/contexts/ToastContext';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { RoleForm, submitRoleForm } from '../components';
import './SettingsPage.css';
import './RoleTree.css';

const ORG_ROOT_ID = 'ORG_ROOT_NODE';
// --- Helper Component for the Tree Node ---
const RoleTreeNode = ({
    node,
    level,
    onEdit,
    onDelete,
    onCreateChild,
    isLast
}: {
    node: RoleNode;
    level: number;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onCreateChild: (id: string) => void;
    isLast: boolean;
}) => {
    const isRoot = node.id === ORG_ROOT_ID;
    // Always expand the root Organization node by default
    const [isExpanded, setIsExpanded] = useState<boolean>(isRoot || true);
    const hasChildren = node.children && node.children.length > 0;



    return (
        <div className="tree-branch">
            <div className={`tree-node-content ${level === 0 ? 'root-node' : ''}`}>
                {/* Connector Lines */}
                <div className="tree-connectors">
                    {level > 0 && <span className="connector-elbow"></span>}
                </div>

                {/* Expansion Toggle */}
                <button
                    className={`tree-toggle ${!hasChildren ? 'invisible' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Icon & Label */}
                <div className="node-card" onClick={() => onEdit(node.id)}>
                    <div className="node-icon">
                        {isRoot ? (
                            <Building2 size={16} className="text-primary" />
                        ) : (
                            <User size={16} className={hasChildren ? 'text-primary' : 'text-muted'} />
                        )}
                    </div>
                    <div className="node-info">
                        <span className="node-name">{node.name}</span>
                    </div>
                </div>

                {/* Actions (Create / Edit / Delete) */}
                <div className="node-actions">
                    {/* New "Add Child" Button */}
                    <button
                        className="btn-icon-mini success"
                        title="Add Child Role"
                        {...(!isRoot && {
                            onClick: (e) => { e.stopPropagation(); onCreateChild(node.id); }
                        })}
                        {...(isRoot && {
                            onClick: (e) => { e.stopPropagation(); onCreateChild(''); }
                        })}
                    >
                        <Plus size={12} />
                    </button>
                    {!isRoot && (
                        <button
                            className="btn-icon-mini"
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); onEdit(node.id); }}
                        >
                            <Edit2 size={12} />
                        </button>
                    )}
                    {!isRoot && (
                        <button
                            className="btn-icon-mini danger"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Recursive Children */}
            {hasChildren && isExpanded && (
                <div className="tree-children">
                    {node.children!.map((child, index) => (
                        <RoleTreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onCreateChild={onCreateChild} // Pass it down
                            isLast={index === node.children!.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function RolesPage() {
    const toast = useToast();
    // --------------------- Tree State ---------------------
    const [viewMode, setViewMode] = useState<'table' | 'tree'>('tree');
    const [roleTree, setRoleTree] = useState<RoleNode[]>([]);
    const [loadingTree, setLoadingTree] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | null>(null); // Track parent for new role

    // Load Tree Function
    const loadTree = useCallback(async () => {
        // Only load if we are in tree view to save bandwidth
        if (viewMode !== 'tree') return;

        setLoadingTree(true);
        try {
            const tree: RoleNode[] = await rolesApi.getTree();
            setRoleTree(tree || []);
        } catch (err) {
            console.error('Failed to load role tree', err);
        } finally {
            setLoadingTree(false);
        }
    }, [viewMode]);

    // --------------------- Table/Data State ---------------------
    const {
        data: roles,
        isLoading,
        error: listError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        setPage,
        reload: reloadTable, // Rename for clarity
        filters,
        setFilters
    } = usePaginatedData<Role>(rolesApi.list, { initialLimit: 100 });

    // --------------------- CRUD Operations ---------------------
    const {
        showFormModal,
        editingItem,
        openCreate, // We will wrap this
        openEdit,
        closeForm,
        handleFormSuccess,
        showDeleteModal,
        deletingItem,
        deleteLoading,
        openDelete,
        confirmDelete,
        closeDelete,
        editLoading,
        error: crudError,
    } = useCrud<Role>({
        deleteFn: rolesApi.delete,
        getByIdFn: rolesApi.getById,
        entityName: 'roles',
        // IMPORTANT: Refresh BOTH Table and Tree on any success (create/update/delete)
        onSuccess: () => {
            reloadTable();
            loadTree();
        },
        toast,
    });

    const [showFilterModal, setShowFilterModal] = useState(false);
    const detailsModal = useDetailsModal();

    const roleFields = useMemo<FieldConfig<Role>[]>(() => [
        { label: 'Name', key: 'name' },
        { label: 'Code', key: 'code' },
        { label: 'Description', key: 'description' },
        { label: 'Parent Role', key: 'parent_role_id' },
        {
            label: 'Status', key: 'is_active', render: (v: boolean) => (
                <span className={`status-badge status-${v ? 'active' : 'inactive'}`}>{v ? 'Active' : 'Inactive'}</span>
            )
        },
        {
            label: 'Profiles', key: 'profiles', render: (v: any) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((p: any) => p.name).join(', ');
            }
        },
        { label: 'User Count', key: 'user_count' },
        { label: 'Child Roles', key: 'child_role_count' },
        { label: 'Created At', key: 'created_at', render: (v: any) => v ? new Date(v).toLocaleString() : '—' },
        { label: 'Created By', key: 'created_by_name' },
    ], []);

    const error = listError || crudError;

    // Trigger tree load when view mode changes
    useEffect(() => {
        if (viewMode === 'tree') {
            loadTree();
        }
    }, [viewMode, loadTree]);


    // --------------------- Handlers ---------------------

    // 1. Wrapper for "Add Role" (Global or Child)
    const handleCreate = (parentId: string | null = null) => {
        const effectiveParentId = parentId === 'ROOT' ? null : parentId;
        setCreateParentId(effectiveParentId);
        openCreate();
    };

    const handleNodeClick = async (nodeId: string) => {
        if (nodeId === ORG_ROOT_ID) return; // Ignore root click
        try {
            const role: Role = await rolesApi.getById(nodeId);
            openEdit(role);
        } catch (err) {
            console.error('Failed to fetch role', err);
        }
    };

    const handleDeleteNode = async (nodeId: string) => {
        if (nodeId === ORG_ROOT_ID) return; // Ignore root delete
        try {
            const role: Role = await rolesApi.getById(nodeId);
            openDelete(role);
        } catch (err) {
            console.error('Failed to fetch role for deletion', err);
        }
    };

    const organizationNode: RoleNode = {
        id: ORG_ROOT_ID,
        name: 'Organization',
        hasChildren: true,
        children: roleTree,
    };

    // --------------------- UI ---------------------
    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Roles</h1>
                    <p>Manage user roles and hierarchies</p>
                </div>
                {/* Global Create Button (Root Level) */}
                <button className="btn btn-primary" onClick={() => handleCreate(null)}>
                    <Plus size={18} /> Add Role
                </button>
            </header>

            {/* Toolbar */}
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

                <button
                    className={`btn ${Object.keys(filters).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilterModal(true)}
                >
                    <Filter size={18} /> Filter
                    {Object.keys(filters).length > 0 && <span className="badge">{Object.keys(filters).length}</span>}
                </button>

                <div className="view-toggle">
                    <button
                        className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('table')}
                    >
                        Table View
                    </button>
                    <button
                        className={`btn ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('tree')}
                    >
                        Tree View
                    </button>
                </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {viewMode === 'table' ? (
                // ... Existing Table View (No changes needed) ...
                isLoading ? (
                    <div className="loading-state">Loading roles...</div>
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
                                    {roles.length > 0 ? roles.map(role => (
                                        <tr key={role.id}>
                                            <td data-label="Name" className="clickable-cell" onClick={() => detailsModal.open(role.id)}>{role.name}</td>
                                            <td data-label="Code" className="clickable-cell" onClick={() => detailsModal.open(role.id)}><code>{role.code}</code></td>
                                            <td data-label="Description" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(role.id)}>{role.description || '-'}</td>
                                            <td data-label="Status" className="clickable-cell" onClick={() => detailsModal.open(role.id)}>
                                                <span className={`status-badge status-${role.is_active ? 'active' : 'inactive'}`}>
                                                    {role.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td data-label="Actions">
                                                <div className="action-buttons">
                                                    <button className="btn-icon" title="Edit" onClick={() => openEdit(role)} disabled={editLoading}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn-icon btn-danger" title="Delete" onClick={() => openDelete(role)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="empty-state">No roles found</td>
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
                )
            ) : (
                // --- TREE VIEW ---
                loadingTree ? (
                    <div className="loading-state">Loading hierarchy...</div>
                ) : roleTree.length === 0 ? (
                    <div className="empty-state">No role hierarchy found</div>
                ) : (
                    <div className="role-tree-container">
                        <div className="tree-header">Organization Chart</div>
                        <div className="tree-wrapper">
                            <RoleTreeNode
                                key={organizationNode.id}
                                node={organizationNode}
                                level={0}
                                onEdit={handleNodeClick}
                                onDelete={handleDeleteNode}
                                onCreateChild={handleCreate}
                                isLast={true}
                            />
                        </div>
                    </div>
                )
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={showFormModal}
                title={editingItem ? 'Edit Role' : (createParentId ? 'Add Child Role' : 'Add New Role')}
                isLoading={false}
                onSubmit={() => submitRoleForm()}
                onCancel={() => {
                    closeForm();
                    setCreateParentId(null); // Reset parent ID on close
                }}
                size="md"
            >
                <RoleForm
                    role={editingItem}
                    // IMPORTANT: You must update RoleForm to accept 'initialParentId'
                    initialParentId={createParentId}
                    onSuccess={handleFormSuccess}
                    onError={(err) => toast.error(err)}
                    setLoading={() => { }}
                />
            </FormModal>

            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Role"
                message="Are you sure you want to delete this role? Users assigned this role will lose associated permissions."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />

            {/* ... Filter Modal (Same as before) ... */}
            <FormModal
                isOpen={showFilterModal}
                title="Filter Roles"
                onSubmit={() => setShowFilterModal(false)}
                onCancel={() => setShowFilterModal(false)}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={filters.is_active === undefined ? '' : filters.is_active.toString()}
                            onChange={(e) => setFilters({
                                ...filters,
                                is_active: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    {Object.keys(filters).length > 0 && (
                        <button
                            className="btn btn-text"
                            onClick={() => {
                                setFilters({});
                                setShowFilterModal(false);
                            }}
                            style={{ marginTop: '1rem' }}
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            </FormModal>

            {/* Details Modal */}
            <DetailsModal<Role>
                isOpen={detailsModal.isOpen}
                title="Role Details"
                entityId={detailsModal.selectedId}
                fetchFn={rolesApi.getById}
                fields={roleFields}
                onClose={detailsModal.close}
                size="md"
            />
        </div>
    );
}
