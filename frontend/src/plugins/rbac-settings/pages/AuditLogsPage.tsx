import { useState, useEffect } from 'react';
import { auditLogsApi } from '../../../core/api/rbac.api';
import type { AuditLog } from '../../../core/types/audit.types';
import { Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import './SettingsPage.css';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';

export function AuditLogsPage() {
    const [searchQuery, setSearchQuery] = useState('');

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
        setPage,
        setLimit,
        reload
    } = usePaginatedData<AuditLog>(auditLogsApi.list, 20);

    // Debugging: Log the values of the current page and the API response
    useEffect(() => {
        console.log(`Current page: ${page}`);
        console.log(`Total pages: ${totalPages}`);
    }, [page, totalPages]);

    // Filter the logs based on search query
    const filteredLogs = (logs || []).filter(log =>
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );

    return (
        <div className="settings-page">
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
            </div>

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
                                {filteredLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="text-muted">
                                            {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss') : '-'}
                                        </td>
                                        <td>{log.user_name || log.user_email || '-'}</td>
                                        <td>
                                            <span className="action-badge">{log.action || '-'}</span>
                                        </td>
                                        <td>
                                            <code>{log.entity_type || '-'}</code>
                                            <span className="text-muted">
                                                #{log.entity_id ? log.entity_id.toString().slice(0, 8) : '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${getStatusColor(log.status || '')}`}>
                                                {log.status || '-'}
                                            </span>
                                        </td>
                                        <td className="text-muted">{log.ip_address || '-'}</td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="empty-state">No audit logs found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="pagination">
                        {/* Previous Page Button */}
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            className="pagination-button"
                        >
                            Previous
                        </button>

                        {/* Page Info */}
                        <span className="pagination-info">
                            Page {page} of {totalPages}
                        </span>

                        {/* Next Page Button */}
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
        </div>
    );
}
