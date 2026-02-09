import { useState } from 'react';
import { sessionsApi } from '../../../core/api/rbac.api';
import type { Session } from '../../../core/types/session.types';
import { Search, LogOut, ShieldAlert, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../../../core/hooks';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function SessionsPage() {
    const revokeModal = useModal<Session>();
    const revokeAllModal = useModal<Session>();
    const [revokeLoading, setRevokeLoading] = useState(false);

    // Fetch paginated sessions
    const {
        data: sessions,
        isLoading,
        error: listError,
        page,
        totalPages,
        setPage,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        reload
    } = usePaginatedData<Session>(sessionsApi.getAll, { initialLimit: 10 });

    const [showFilterModal, setShowFilterModal] = useState(false);

    const handleRevoke = async () => {
        if (!revokeModal.data) return;
        setRevokeLoading(true);
        try {
            await sessionsApi.revoke(revokeModal.data.id);
            revokeModal.close();
            reload();
        } catch (err: any) {
            console.error('Failed to revoke session:', err);
        } finally {
            setRevokeLoading(false);
        }
    };

    const handleRevokeAll = async () => {
        if (!revokeAllModal.data) return;
        setRevokeLoading(true);
        try {
            await sessionsApi.revokeAllByUser(revokeAllModal.data.user_id);
            revokeAllModal.close();
            reload();
        } catch (err: any) {
            console.error('Failed to revoke all sessions:', err);
        } finally {
            setRevokeLoading(false);
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>User Sessions</h1>
                    <p>Manage active sessions and security</p>
                </div>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by User ID..."
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

            {listError && (
                <div className="error-banner">
                    {listError}
                </div>
            )}

            {isLoading ? (
                <div className="loading-state">Loading sessions...</div>
            ) : (
                <>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Session ID</th>
                                    <th>User ID</th>
                                    <th>IP Address</th>
                                    <th>User Agent</th>
                                    <th>Login Time</th>
                                    <th>Logout/Expires</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(session => (
                                    <tr key={session.id}>
                                        <td>
                                            <code>{session.id.slice(0, 8)}</code>
                                        </td>
                                        <td>{session.user_id}</td>
                                        <td>{session.ip_address}</td>
                                        <td title={session.user_agent}>{session.user_agent}</td>
                                        <td>{format(new Date(session.login_at), 'MMM d, HH:mm')}</td>
                                        <td>{session.logout_at ? "Logout at " + format(new Date(session.logout_at), 'MMM d, HH:mm') : "Expires at " + format(new Date(session.expires_at), 'MMM d, HH:mm')}</td>
                                        <td>{session.logout_at
                                            ? <span className="status-badge status-inactive">Inactive</span>
                                            : <span className="status-badge status-active">Active</span>
                                        }</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon btn-danger"
                                                    title="Revoke Session"
                                                    onClick={() => revokeModal.open(session)}
                                                >
                                                    <LogOut size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-warning"
                                                    title="Revoke All for User"
                                                    onClick={() => revokeAllModal.open(session)}
                                                >
                                                    <ShieldAlert size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="empty-state">No sessions found</td>
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

            {/* Confirm modals */}
            <ConfirmModal
                isOpen={revokeModal.isOpen}
                title="Revoke Session"
                message="Are you sure you want to revoke this session?"
                itemName={revokeModal.data?.id.slice(0, 8) + '...'}
                confirmLabel="Revoke"
                variant="danger"
                isLoading={revokeLoading}
                onConfirm={handleRevoke}
                onCancel={revokeModal.close}
            />

            <ConfirmModal
                isOpen={revokeAllModal.isOpen}
                title="Revoke All Sessions"
                message="Are you sure you want to revoke all sessions for this user?"
                itemName={revokeAllModal.data?.user_id}
                confirmLabel="Revoke All"
                variant="danger"
                isLoading={revokeLoading}
                onConfirm={handleRevokeAll}
                onCancel={revokeAllModal.close}
            />

            {/* Filter Modal Placeholder */}
            <FormModal
                isOpen={showFilterModal}
                title="Filter Sessions"
                onSubmit={() => setShowFilterModal(false)}
                onCancel={() => setShowFilterModal(false)}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Session Status</label>
                        <select
                            className="form-control"
                            value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                            onChange={(e) => setFilters({
                                ...filters,
                                isActive: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Sessions</option>
                            <option value="true">Active Only</option>
                            <option value="false">Expired/Revoked Only</option>
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
