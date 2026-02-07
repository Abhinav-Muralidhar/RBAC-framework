/**
 * Sessions Page
 * 
 * Manage user sessions with confirmation modals.
 */

import { useState, useEffect } from 'react';
import { sessionsApi } from '../../../core/api/rbac.api';
import type { Session } from '../../../core/types/session.types';
import { Search, LogOut, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useModal } from '../../../core/hooks';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import './SettingsPage.css';


export function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSession, setCurrentSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal hooks for confirmations
    const revokeModal = useModal<Session>();
    const revokeAllModal = useModal<Session>();
    const [revokeLoading, setRevokeLoading] = useState(false);

    useEffect(() => {
        loadAllSessions();
    }, []);

    const loadAllSessions = async () => {
        try {
            setIsLoading(true);
            setError('');
            const response = await sessionsApi.getAll(); // fetch all sessions
            if (response && Array.isArray(response.data)) {
                setSessions(response.data); // use response.data
            } else {
                setSessions([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions');
            setSessions([]);
        } finally {
            setIsLoading(false);
        }
    };


    const handleRevoke = async () => {
        if (!revokeModal.data) return;
        setRevokeLoading(true);
        try {
            await sessionsApi.revoke(revokeModal.data.id);
            revokeModal.close();
            loadAllSessions(); // reload all sessions after revoke
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke session');
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
            loadAllSessions(); // reload all sessions after revoke all
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
        } finally {
            setRevokeLoading(false);
        }
    };


    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchQuery.trim());
    };

    // Filter sessions if searchQuery is set
    const filteredSessions = searchQuery
        ? sessions.filter(s => s.user_id.includes(searchQuery))
        : sessions;
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
                        <ShieldAlert size={18} />
                        Revoke All
                    </button>
                </div>
            </header>

            <div className="page-toolbar">
                <form className="search-box" onSubmit={handleSearch}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by User ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </form>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            <div className="session-info-bar">
                <p>
                    Showing sessions {searchQuery ? `for User ID: ${searchQuery}` : 'for all users'}
                </p>
            </div>

            {isLoading ? (
                <div className="loading-state">Loading sessions...</div>
            ) : (
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
                            {filteredSessions.map(session => {
                                const isCurrent = currentSession?.id === session.id;
                                return (
                                    <tr key={session.id} className={isCurrent ? 'bg-blue-50' : ''}>
                                        <td>
                                            <code title={session.id}>{session.id.slice(0, 8)}...</code>
                                            {isCurrent && <span className="badge badge-primary ml-2">Current</span>}
                                        </td>
                                        <td>{session.user_id}</td>
                                        <td>{session.ip_address}</td>
                                        <td className="max-w-xs truncate" title={session.user_agent}>
                                            {session.user_agent}
                                        </td>
                                        <td>{format(new Date(session.login_at), 'MMM d, HH:mm')}</td>
                                        <td>{format(new Date(session.expires_at), 'MMM d, HH:mm')}</td>
                                        <td>
                                            <span className="status-badge status-active">Active</span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn-icon btn-danger"
                                                title="Revoke Session"
                                                onClick={() => revokeModal.open(session)}
                                                disabled={isCurrent}
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
                                );
                            })}
                            {filteredSessions.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="empty-state">No active sessions found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Revoke Single Session Confirmation */}
            <ConfirmModal
                isOpen={revokeModal.isOpen}
                title="Revoke Session"
                message="Are you sure you want to revoke this session? The user will be logged out."
                itemName={revokeModal.data?.id.slice(0, 8) + '...'}
                confirmLabel="Revoke"
                variant="danger"
                isLoading={revokeLoading}
                onConfirm={handleRevoke}
                onCancel={revokeModal.close}
            />

            {/* Revoke All Sessions for User Confirmation */}
            <ConfirmModal
                isOpen={revokeAllModal.isOpen}
                title="Revoke All Sessions"
                message="Are you sure you want to revoke ALL sessions for this user? They will be logged out of all devices."
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
