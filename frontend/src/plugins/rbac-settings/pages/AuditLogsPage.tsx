/**
 * Audit Logs Page
 *
 * View system audit trail (all data decrypted server-side).
 */

import { useMemo, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import type { AuditLog, AuditLogSummaryDto } from '../../../core/types/audit.types';
import { auditLogsApi } from '../../../core/api/rbac.api';
import type { PaginationParams } from '../../../core/hooks/usePaginatedData';
import { createPaginatedSource, usePaginatedData, useDetailsModal } from '../../../core/hooks';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import { FormModal } from '../../../core/components/FormModal';
import { RbacPageSkeleton } from '../components/RbacPageSkeleton';
import './SettingsPage.css';

export function AuditLogsPage() {
    const [isExporting, setIsExporting] = useState(false);
    const actionOptions = ['create', 'update', 'delete', 'export'];
    const entityTypeOptions = [
        'organization',
        'user',
        'role',
        'profile',
        'group',
        'module',
        'permission',
        'session',
        'smtp_config',
        'sharing_rule',
        'otp'
    ];

    // Function to get the color based on the status
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'status-active';
            case 'failure': return 'status-inactive';
            case 'denied': return 'status-deleted';
            default: return '';
        }
    };

    // Fetch paginated logs using the custom hook
    const {
        data: logs,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        limitOptions,
        filters,
        draftFilters,
        setDraftFilters,
        filterModal,
        setPage,
        setLimit,
        searchQuery,
        setSearchQuery,
    } = usePaginatedData<AuditLogSummaryDto>(createPaginatedSource('auditLogs', auditLogsApi.list));

    const detailsModal = useDetailsModal();

    const auditFields = useMemo<FieldConfig<AuditLog>[]>(() => [
        { label: 'Timestamp', key: 'created_at', render: (v: unknown) => (typeof v === 'string' || v instanceof Date) ? new Date(v as string).toLocaleString() : '—' },
        { label: 'User ID', key: 'user_id' },
        { label: 'User Name', key: 'user_name' },
        { label: 'Action', key: 'action' },
        { label: 'Entity', key: 'entity_type' },
        { label: 'Entity ID', key: 'entity_id' },
        { label: 'Module', key: 'module_name' },
        {
            label: 'Status', key: 'status', render: (v: unknown) => (
                <span className={`status-badge status-${(v as string)?.toLowerCase()}`}>{v as string}</span>
            )
        },
        { label: 'IP Address', key: 'ip_address' },
        { label: 'User Agent', key: 'user_agent' },
        { label: 'Old Values', key: 'old_values' },
        { label: 'New Values', key: 'new_values' },
    ], []);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const blob = await auditLogsApi.exportPdf({
                ...(filters.action ? { action: filters.action as string } : {}),
                ...(filters.entity_type ? { entity_type: filters.entity_type as string } : {}),
                ...(filters.user_name ? { user_name: filters.user_name as string } : {}),
            } as PaginationParams & Record<string, string>);

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `audit-logs-page-${page}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (exportError) {
            console.error(exportError);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="settings-page">
            {isLoading && logs.length === 0 ? (
                <RbacPageSkeleton columns={6} rows={4} />
            ) : (
                <>
                    <header className="page-header">
                        <div>
                            <h1>System Audit Logs</h1>
                            <p>View system activity and changes</p>
                        </div>
                    </header>

                    <div className="page-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button
                            className={`btn ${Object.keys(filters).filter(k => filters[k] !== undefined).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={filterModal.open}
                        >
                            <Filter size={18} /> Filter
                            {Object.keys(filters).filter(k => filters[k] !== undefined).length > 0 && (
                                <span className="badge">{Object.keys(filters).filter(k => filters[k] !== undefined).length}</span>
                            )}
                        </button>
                        <button className="btn btn-secondary" onClick={handleExport} disabled={isExporting || isLoading}>
                            <Download size={18} />
                            {isExporting ? 'Exporting...' : 'Export PDF'}
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Status</th>
                                    <th>IP Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} className="clickable-row" onClick={() => detailsModal.open(log.id)}>
                                        <td data-label="Timestamp" className="text-muted">
                                            {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td data-label="User">{log.user_name || log.user_email || '-'}</td>
                                        <td data-label="Action">
                                            <span className="action-badge">{log.action || '-'}</span>
                                        </td>
                                        <td data-label="Entity">
                                            <code>{log.entity_type || '-'}</code>
                                            <span className="text-muted">
                                                #{log.entity_id ? log.entity_id.toString().slice(0, 8) : '-'}
                                            </span>
                                        </td>
                                        <td data-label="Status">
                                            <span className={`status-badge ${getStatusColor(log.status || '')}`}>
                                                {log.status || '-'}
                                            </span>
                                        </td>
                                        <td data-label="IP Address" className="text-muted">{log.ip_address || '-'}</td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="empty-state">No audit logs found</td>
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
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            className="pagination-button"
                        >
                            Previous
                        </button>
                        <span className="pagination-info">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="pagination-button"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            <DetailsModal<AuditLog>
                isOpen={detailsModal.isOpen}
                title="System Audit Log Details"
                entityId={detailsModal.selectedId}
                fetchFn={auditLogsApi.getById}
                fields={auditFields}
                onClose={detailsModal.close}
                size="lg"
            />

            <FormModal
                isOpen={filterModal.isOpen}
                title="Filter System Audit Logs"
                onSubmit={filterModal.submit}
                onCancel={filterModal.close}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Action</label>
                        <select
                            className="form-control"
                            value={(draftFilters.action as string) || ''}
                            onChange={(e) => setDraftFilters({ ...draftFilters, action: e.target.value || undefined })}
                        >
                            <option value="">All Actions</option>
                            {actionOptions.map((action) => (
                                <option key={action} value={action}>
                                    {action}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-field">
                        <label className="form-label">Entity Type</label>
                        <select
                            className="form-control"
                            value={(draftFilters.entity_type as string) || ''}
                            onChange={(e) => setDraftFilters({ ...draftFilters, entity_type: e.target.value || undefined })}
                        >
                            <option value="">All Entity Types</option>
                            {entityTypeOptions.map((entityType) => (
                                <option key={entityType} value={entityType}>
                                    {entityType}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-field">
                        <label className="form-label">User Name</label>
                        <input
                            className="form-control"
                            value={(draftFilters.user_name as string) || ''}
                            onChange={(e) => setDraftFilters({ ...draftFilters, user_name: e.target.value || undefined })}
                            placeholder="Search by user name"
                        />
                    </div>

                    {Object.keys(draftFilters).filter(k => draftFilters[k] !== undefined).length > 0 && (
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
        </div>
    );
}
