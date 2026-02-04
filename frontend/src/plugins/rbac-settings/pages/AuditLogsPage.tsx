/**
 * Audit Logs Page
 * (Centralized Hook Version)
 */

import { Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import type { AuditLog } from '../../../core/types/audit.types';
import { auditLogsApi } from '../../../core/api/rbac.api';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

export function AuditLogsPage() {

    const crud = useCrudPage<AuditLog>({
        listFn: auditLogsApi.list,
        deleteFn: async () => { },
        entityName: 'audit logs',
        initialLimit: 20,
    });

    const filteredLogs = crud.items.filter(log =>
        log.action.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(crud.searchQuery.toLowerCase()) ||
        (log.user_name?.toLowerCase().includes(crud.searchQuery.toLowerCase()) ?? false)
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'status-active';
            case 'failure': return 'status-inactive';
            case 'denied': return 'status-deleted';
            default: return '';
        }
    };

    return (
        <div className="settings-page">

            {/* Header */}
            <header className="page-header">
                <div>
                    <h1>Audit Logs</h1>
                    <p>View system activity and changes</p>
                </div>

                <button className="btn btn-secondary">
                    <Filter size={18} />
                    Filters
                </button>
            </header>

            {/* Search */}
            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={crud.searchQuery}
                        onChange={(e) => crud.setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Error */}
            {crud.error && (
                <div className="error-banner">
                    {crud.error}
                    <button onClick={crud.clearError}>×</button>
                </div>
            )}

            {/* Loading */}
            {crud.isLoading ? (
                <div className="loading-state">Loading audit logs...</div>
            ) : (
                <>
                    {/* Table */}
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
                                {filteredLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="text-muted">
                                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                                        </td>

                                        <td>{log.user_name || log.user_email || '-'}</td>

                                        <td>
                                            <span className="action-badge">
                                                {log.action}
                                            </span>
                                        </td>

                                        <td>
                                            <code>{log.entity_type}</code>
                                            <span className="text-muted">
                                                {' '}#{log.entity_id.slice(0, 8)}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={`status-badge ${getStatusColor(log.status)}`}
                                            >
                                                {log.status}
                                            </span>
                                        </td>

                                        <td className="text-muted">
                                            {log.ip_address}
                                        </td>
                                    </tr>
                                ))}

                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="empty-state">
                                            No audit logs found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination">
                        <button
                            disabled={crud.page <= 1}
                            onClick={crud.prevPage}
                        >
                            Previous
                        </button>

                        <span>
                            Page {crud.page} of {crud.totalPages}
                        </span>

                        <button
                            disabled={crud.page >= crud.totalPages}
                            onClick={crud.nextPage}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
