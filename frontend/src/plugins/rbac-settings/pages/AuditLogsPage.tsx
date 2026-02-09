import { useState } from 'react';
import { auditLogsApi } from '../../../core/api/rbac.api';
import type { AuditLog } from '../../../core/types/audit.types';
import { Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import './SettingsPage.css';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import { FormModal } from '../../../core/components/FormModal';

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
        searchQuery,
        setSearchQuery,
        filters,
        setFilters
    } = usePaginatedData<AuditLog>(auditLogsApi.list, { initialLimit: 20 });

    const [showFilterModal, setShowFilterModal] = useState(false);

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Audit Logs</h1>
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
                    className={`btn ${Object.keys(filters).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilterModal(true)}
                >
                    <Filter size={18} /> Filter
                    {Object.keys(filters).length > 0 && <span className="badge">{Object.keys(filters).length}</span>}
                </button>
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
                                {logs.map(log => (
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

            {/* Filter Modal Placeholder */}
            <FormModal
                isOpen={showFilterModal}
                title="Filter Audit Logs"
                onSubmit={() => setShowFilterModal(false)}
                onCancel={() => setShowFilterModal(false)}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select
                            className="form-control"
                            value={filters.status || ''}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="failure">Failure</option>
                            <option value="denied">Denied</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label className="form-label">Action</label>
                        <select
                            className="form-control"
                            value={filters.action || ''}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
                        >
                            <option value="">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label className="form-label">Entity Type</label>
                        <select
                            className="form-control"
                            value={filters.entity_type || ''}
                            onChange={(e) => setFilters({ ...filters, entity_type: e.target.value || undefined })}
                        >
                            <option value="">All Entities</option>
                            <option value="user">User</option>
                            <option value="role">Role</option>
                            <option value="profile">Profile</option>
                            <option value="group">Group</option>
                            <option value="session">Session</option>
                        </select>
                    </div>
                    {Object.keys(filters).filter(k => filters[k] !== undefined).length > 0 && (
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
        </div>
    );
}
