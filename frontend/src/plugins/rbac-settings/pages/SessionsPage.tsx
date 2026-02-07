import { useState } from 'react';
import { sessionsApi } from '../../../core/api/rbac.api';
import type { Session } from '../../../core/types/session.types';
import { Search, LogOut, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../../../core/hooks';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { usePaginatedData } from '../../../core/hooks/usePaginatedData';
import './SettingsPage.css';

export function SessionsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const revokeModal = useModal<Session>();
    const revokeAllModal = useModal<Session>();
    const [revokeLoading, setRevokeLoading] = useState(false);

    // Fetch paginated sessions
    const {
        data: sessions,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        setPage,
        setLimit,
        reload
    } = usePaginatedData<Session>(sessionsApi.getAll, 20);

    const filteredSessions = (sessions || []).filter(s =>
        !searchQuery ||
        s.user_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRevoke = async () => {
        if (!revokeModal.data) return;
        setRevokeLoading(true);
        try {
            await sessionsApi.revoke(revokeModal.data.id);
            revokeModal.close();
            reload();
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
                <div className="header-actions">
                    <button
                        className="btn btn-danger"
                        onClick={() => revokeAllModal.open(filteredSessions[0] || null)}
                        disabled={!filteredSessions.length}
                    >
                        <ShieldAlert size={18} /> Revoke All
                    </button>
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
            </div>

            {error && (
                <div className="error-banner">
                    {error} <button onClick={() => { }}>×</button>
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
                                    <th>Expires</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSessions.map(session => (
                                    <tr key={session.id}>
                                        <td>
                                            <code>{session.id.slice(0, 8)}...</code>
                                        </td>
                                        <td>{session.user_id}</td>
                                        <td>{session.ip_address}</td>
                                        <td title={session.user_agent}>{session.user_agent}</td>
                                        <td>{format(new Date(session.login_at), 'MMM d, HH:mm')}</td>
                                        <td>{format(new Date(session.expires_at), 'MMM d, HH:mm')}</td>
                                        <td><span className="status-badge status-active">Active</span></td>
                                        <td>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Revoke Session"
                                                onClick={() => revokeModal.open(session)}
                                            >
                                                <LogOut size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-warning ml-1"
                                                title="Revoke All for User"
                                                onClick={() => revokeAllModal.open(session)}
                                            >
                                                <ShieldAlert size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredSessions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="empty-state">No sessions found</td>
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
        </div>
    );
}
