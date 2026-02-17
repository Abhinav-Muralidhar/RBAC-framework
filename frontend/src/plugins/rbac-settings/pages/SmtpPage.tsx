/**
 * SMTP Settings Page
 * 
 * Manage SMTP configurations for email delivery.
 * Uses usePaginatedData for list management and useCrud for modals.
 */

import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Check, Mail, Server, Search, Filter } from 'lucide-react';
import type { SmtpConfig } from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { SmtpForm, submitSmtpForm } from '../components';
import { usePaginatedData, useCrud, useDetailsModal } from '../../../core/hooks';
import './SettingsPage.css';

export function SmtpPage() {
    const {
        data: configs,
        isLoading,
        error: listError,
        searchQuery,
        setSearchQuery,
        page,
        totalPages,
        setPage,
        reload,
        filters,
        setFilters
    } = usePaginatedData<SmtpConfig>(smtpApi.list, { initialLimit: 20 });

    const {
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
        editLoading,
        error: crudError,
    } = useCrud<SmtpConfig>({
        deleteFn: smtpApi.delete,
        getByIdFn: smtpApi.getById,
        entityName: 'SMTP configuration',
        onSuccess: reload,
    });

    const [showFilterModal, setShowFilterModal] = useState(false);
    const detailsModal = useDetailsModal();

    const smtpFields = useMemo<FieldConfig<SmtpConfig>[]>(() => [
        { label: 'Name', key: 'name' },
        { label: 'Host', key: 'host' },
        { label: 'Port', key: 'port' },
        { label: 'Username', key: 'username' },
        { label: 'Encryption', key: 'encryption', render: (v: string) => v?.toUpperCase() || '—' },
        { label: 'From Email', key: 'from_email' },
        { label: 'From Name', key: 'from_name' },
        { label: 'Reply-To Email', key: 'reply_to_email' },
        {
            label: 'Status', key: 'is_active', render: (v: boolean) => (
                <span className={`status-badge status-${v ? 'active' : 'inactive'}`}>{v ? 'Active' : 'Inactive'}</span>
            )
        },
    ], []);

    const error = listError || crudError;

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>SMTP Configuration</h1>
                    <p>Manage email server settings for system notifications</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} />
                    Add Configuration
                </button>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search configurations..."
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
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="loading-state">Loading SMTP configurations...</div>
            ) : configs.length === 0 ? (
                <div className="empty-state">
                    <Server size={48} />
                    <h3>No SMTP Configurations</h3>
                    <p>Add your first SMTP server configuration to enable email delivery.</p>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={18} />
                        Add Configuration
                    </button>
                </div>
            ) : (
                <>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Host</th>
                                    <th className="hide-mobile">Port</th>
                                    <th className="hide-mobile">From</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map(config => (
                                    <tr key={config.id}>
                                        <td data-label="Name" className="clickable-cell" onClick={() => detailsModal.open(config.id)}>
                                            <div className="cell-primary">
                                                <Mail size={16} />
                                                {config.name}
                                            </div>
                                        </td>
                                        <td data-label="Host" className="clickable-cell" onClick={() => detailsModal.open(config.id)}>{config.host}</td>
                                        <td data-label="Port" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(config.id)}>{config.port}</td>
                                        <td data-label="From" className="hide-mobile clickable-cell" onClick={() => detailsModal.open(config.id)}>{config.from_email}</td>
                                        <td data-label="Status" className="clickable-cell" onClick={() => detailsModal.open(config.id)}>
                                            {config.is_active ? (
                                                <span className="status-badge status-active">
                                                    <Check size={12} /> Active
                                                </span>
                                            ) : (
                                                <span className="status-badge status-inactive">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td data-label="Actions">
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => openEdit(config)}
                                                    title="Edit"
                                                    disabled={editLoading}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-danger"
                                                    onClick={() => openDelete(config)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
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
                title={editingItem ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
                isLoading={false}
                onSubmit={() => submitSmtpForm()}
                onCancel={closeForm}
                size="md"
            >
                <SmtpForm
                    config={editingItem}
                    onSuccess={handleFormSuccess}
                    onError={console.error}
                    setLoading={() => { }}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete SMTP Configuration"
                message="Are you sure you want to delete this SMTP configuration? This action cannot be undone."
                itemName={deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={closeDelete}
            />

            {/* Filter Modal */}
            <FormModal
                isOpen={showFilterModal}
                title="Filter SMTP Configurations"
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
            <DetailsModal<SmtpConfig>
                isOpen={detailsModal.isOpen}
                title="SMTP Configuration Details"
                entityId={detailsModal.selectedId}
                fetchFn={smtpApi.getById}
                fields={smtpFields}
                onClose={detailsModal.close}
                size="md"
            />
        </div>
    );
}
