import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Plus, Edit2, Trash2, Search, Filter,
    ChevronRight, ChevronDown,
    User, Building2, MoreVertical
} from 'lucide-react';
import { rolesApi } from '../../../core/api/rbac.api';
import type { Role, RoleNode } from '../../../core/types/role.types';
import { createPaginatedSource, usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import { useToast } from '../../../core/contexts/useToast';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { RbacFormSkeleton, RbacPageSkeleton } from '../components/RbacPageSkeleton';
import type { RbacFormHandle } from '../components';
import './SettingsPage.css';
import './RoleTree.css';

const RoleForm = lazy(() => import('../components/RoleForm').then((module) => ({ default: module.RoleForm })));

const ORG_ROOT_ID = 'ORG_ROOT_NODE';
// --- Helper Component for the Tree Node ---
const RoleTreeNode = ({
    node,
    level,
    isTouchLayout,
    onEdit,
    onDelete,
    onCreateChild
}: {
    node: RoleNode;
    level: number;
    isTouchLayout: boolean;
    onEdit: (id: string, name?: string) => void;
    onDelete: (id: string) => void;
    onCreateChild: (id: string) => void;
}) => {
    const isRoot = node.id === ORG_ROOT_ID;
    const [isExpanded, setIsExpanded] = useState<boolean>(isRoot || true);
    const [showActions, setShowActions] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    const actionsVisible = isTouchLayout && showActions;

    const handleCardClick = () => {
        if (isTouchLayout) {
            setShowActions(prev => !prev);
            return;
        }
        onEdit(node.id, node.name);
    };

    const handleCreateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowActions(false);
        onCreateChild(isRoot ? '' : node.id);
    };

    const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowActions(false);
        onEdit(node.id, node.name);
    };

    const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowActions(false);
        onDelete(node.id);
    };


    return (
        <div className="tree-branch">
            <div className={`tree-node-content ${level === 0 ? 'root-node' : ''} ${actionsVisible ? 'actions-open' : ''}`}>
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
                <div className="node-card" onClick={handleCardClick}>
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

                <button
                    type="button"
                    className="node-actions-trigger"
                    aria-label="Show role actions"
                    aria-expanded={actionsVisible}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowActions(prev => !prev);
                    }}
                >
                    <MoreVertical size={14} />
                </button>

                {/* Actions (Create / Edit / Delete) */}
                <div className={`node-actions ${actionsVisible ? 'node-actions--visible' : ''}`}>
                    <button
                        className="btn-icon-mini success"
                        title="Add Child Role"
                        onClick={handleCreateClick}
                    >
                        <Plus size={12} />
                    </button>
                    {!isRoot && (
                        <button
                            className="btn-icon-mini"
                            title="Edit"
                            onClick={handleEditClick}
                        >
                            <Edit2 size={12} />
                        </button>
                    )}
                    {!isRoot && (
                        <button
                            className="btn-icon-mini danger"
                            title="Delete"
                            onClick={handleDeleteClick}
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Recursive Children */}
            {hasChildren && isExpanded && (
                <div className="tree-children">
                    {node.children!.map((child) => (
                        <RoleTreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            isTouchLayout={isTouchLayout}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onCreateChild={onCreateChild} // Pass it down
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function RolesPage() {
    const toast = useToast();
    const formRef = useRef<RbacFormHandle>(null);
    // --------------------- Tree State ---------------------
    const [viewMode, setViewMode] = useState<'table' | 'tree'>('tree');
    const [roleTree, setRoleTree] = useState<RoleNode[]>([]);
    const [loadingTree, setLoadingTree] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | null>(null); // Track parent for new role
    const [isTouchLayout, setIsTouchLayout] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(max-width: 768px), (hover: none)');
        const updateLayoutMode = () => setIsTouchLayout(mediaQuery.matches);

        updateLayoutMode();
        mediaQuery.addEventListener('change', updateLayoutMode);
        return () => mediaQuery.removeEventListener('change', updateLayoutMode);
    }, []);

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
        isInitialLoading,
        error: listError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        limit,
        limitOptions,
        setPage,
        setLimit,
        reload: reloadTable, // Rename for clarity
        filters,
        draftFilters,
        setDraftFilters,
        filterModal
    } = usePaginatedData<Role>(createPaginatedSource('roles', rolesApi.list));

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

    const detailsModal = useDetailsModal();

    const roleFields = useMemo<FieldConfig<Role>[]>(() => [
        { label: 'Name', key: 'name' },
        { label: 'Code', key: 'code' },
        { label: 'Description', key: 'description' },
        { label: 'Parent Role', key: 'parent_role_id' },
        {
            label: 'Status', key: 'is_active', render: (v: unknown) => (
                <span className={`status-badge status-${v ? 'active' : 'inactive'}`}>{v ? 'Active' : 'Inactive'}</span>
            )
        },
        {
            label: 'Profiles', key: 'profiles', render: (v: unknown) => {
                if (!v || !Array.isArray(v) || v.length === 0) return '—';
                return v.map((p: { name: string }) => p.name).join(', ');
            }
        },
        { label: 'User Count', key: 'user_count' },
        { label: 'Child Roles', key: 'child_role_count' },
        { label: 'Created At', key: 'created_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Created By', key: 'created_by_name' },
        { label: 'Updated At', key: 'updated_at', render: (v: unknown) => v ? new Date(v as string).toLocaleString() : '—' },
        { label: 'Updated By', key: 'updated_by_name' },
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

    const handleNodeClick = (nodeId: string, nodeName?: string) => {
        if (nodeId === ORG_ROOT_ID) return; // Ignore root click
        void openEdit({ id: nodeId, name: nodeName || '' } as Role);
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
            {isInitialLoading ? (
                <RbacPageSkeleton columns={5} rows={4} />
            ) : (
                <>
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
                            onClick={filterModal.open}
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
                            <div className="page-size">
                                <label className="form-label">Rows</label>
                                <select
                                    className="form-control"
                                    value={limit}
                                    onChange={(e) => setLimit(Number(e.target.value))}
                                >
                                    {limitOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
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
                                isTouchLayout={isTouchLayout}
                                onEdit={handleNodeClick}
                                onDelete={handleDeleteNode}
                                onCreateChild={handleCreate}
                            />
                        </div>
                    </div>
                )
                    )}
                </>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={showFormModal}
                title={editingItem ? 'Edit Role' : (createParentId ? 'Add Child Role' : 'Add New Role')}
                isLoading={editLoading}
                loadingLabel="Loading..."
                onSubmit={() => formRef.current?.submit()}
                onCancel={() => {
                    closeForm();
                    setCreateParentId(null); // Reset parent ID on close
                }}
                size="md"
            >
                <Suspense fallback={<RbacFormSkeleton />}>
                    <RoleForm
                        ref={formRef}
                        role={editingItem}
                        // IMPORTANT: You must update RoleForm to accept 'initialParentId'
                        initialParentId={createParentId}
                        onSuccess={handleFormSuccess}
                        onError={(err) => toast.error(err)}
                        setLoading={() => { }}
                    />
                </Suspense>
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
                isOpen={filterModal.isOpen}
                title="Filter Roles"
                onSubmit={filterModal.submit}
                onCancel={filterModal.close}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={draftFilters.is_active === undefined ? '' : draftFilters.is_active.toString()}
                            onChange={(e) => setDraftFilters({
                                ...draftFilters,
                                is_active: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    {Object.keys(draftFilters).length > 0 && (
                        <button
                            className="btn btn-text filter-clear"
                            onClick={() => {
                                setDraftFilters({});
                            }}
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
