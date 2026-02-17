/**
 * Audit Logs Page
 *
 * View system audit trail (all data decrypted server-side).
 * Filtering removed — all fields are encrypted at rest.
 */

import { useMemo } from 'react';
import type { AuditLog } from '../../../core/types/audit.types';
import { auditLogsApi } from '../../../core/api/rbac.api';
import { usePaginatedData, useDetailsModal } from '../../../core/hooks';
import { DetailsModal, type FieldConfig } from '../../../core/components/DetailModal';
import './SettingsPage.css';

export function AuditLogsPage() {
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
        setPage,
    } = usePaginatedData<AuditLog>(auditLogsApi.list, { initialLimit: 20 });

    const detailsModal = useDetailsModal();

    const auditFields = useMemo<FieldConfig<AuditLog>[]>(() => [
        { label: 'Timestamp', key: 'created_at', render: (v: any) => v ? new Date(v).toLocaleString() : '—' },
        { label: 'User ID', key: 'user_id' },
        { label: 'Username', key: 'user_name' },
        { label: 'Action', key: 'action' },
        { label: 'Entity', key: 'entity_type' },
        { label: 'Entity ID', key: 'entity_id' },
        { label: 'Module', key: 'module_name' },
        {
            label: 'Status', key: 'status', render: (v: string) => (
                <span className={`status-badge status-${v?.toLowerCase()}`}>{v}</span>
            )
        },
        { label: 'IP Address', key: 'ip_address' },
        { label: 'User Agent', key: 'user_agent' },
        { label: 'Old Values', key: 'old_values' },
        { label: 'New Values', key: 'new_values' },
    ], []);

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Audit Logs</h1>
                    <p>View system activity and changes</p>
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            {isLoading ? (
                <div className="loading-state">Loading audit logs...</div>
            ) : (
                <>
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
                                    <tr key={log.id} className="clickable-row" onClick={() => detailsModal.open(log.id)} style={{ cursor: 'pointer' }}>
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

                    {/* Pagination Controls */}
                    <div className="pagination">
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

            {/* Details Modal */}
            <DetailsModal<AuditLog>
                isOpen={detailsModal.isOpen}
                title="Audit Log Details"
                entityId={detailsModal.selectedId}
                fetchFn={auditLogsApi.getById}
                fields={auditFields}
                onClose={detailsModal.close}
                size="lg"
            />
        </div>
    );
}
