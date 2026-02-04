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

    const { user } = useAuth();
    const [targetUserId, setTargetUserId] = useState('');

    // Modal hooks for confirmations
    const revokeModal = useModal<Session>();
    const revokeAllModal = useModal();
    const [revokeLoading, setRevokeLoading] = useState(false);

    useEffect(() => {
        loadCurrentSession();
        if (user?.id) {
            setTargetUserId(user.id);
            loadUserSessions(user.id);
        }
    }, [user]);

    const loadCurrentSession = async () => {
        try {
            const session = await sessionsApi.getCurrent();
            setCurrentSession(session);
        } catch {
            // Ignore
        }
    };

    const loadUserSessions = async (userId: string) => {
        try {
            setIsLoading(true);
            setError('');
            const response = await sessionsApi.getByUser(userId);
            if (response && Array.isArray(response.data)) {
                setSessions(response.data);
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
            if (targetUserId) loadUserSessions(targetUserId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke session');
        } finally {
            setRevokeLoading(false);
        }
    };

    const handleRevokeAll = async () => {
        if (!targetUserId) return;
        setRevokeLoading(true);
        try {
            await sessionsApi.revokeAllByUser(targetUserId);
            revokeAllModal.close();
            loadUserSessions(targetUserId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
        } finally {
            setRevokeLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery) {
            setTargetUserId(searchQuery);
            loadUserSessions(searchQuery);
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
                        onClick={() => revokeAllModal.open()}
                        disabled={!sessions.length}
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
                <p>Showing sessions for User ID: <strong>{targetUserId || 'None'}</strong></p>
            </div>

            {isLoading ? (
                <div className="loading-state">Loading sessions...</div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Session ID</th>
                                <th>IP Address</th>
                                <th>User Agent</th>
                                <th>Login Time</th>
                                <th>Expires</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(session => {
                                const isCurrent = currentSession?.id === session.id;
                                return (
                                    <tr key={session.id} className={isCurrent ? 'bg-blue-50' : ''}>
                                        <td>
                                            <code title={session.id}>{session.id.slice(0, 8)}...</code>
                                            {isCurrent && <span className="badge badge-primary ml-2">Current</span>}
                                        </td>
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
                                        </td>
                                    </tr>
                                );
                            })}
                            {sessions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="empty-state">No active sessions found</td>
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

            {/* Revoke All Sessions Confirmation */}
            <ConfirmModal
                isOpen={revokeAllModal.isOpen}
                title="Revoke All Sessions"
                message="Are you sure you want to revoke ALL sessions for this user? They will be logged out of all devices."
                confirmLabel="Revoke All"
                variant="danger"
                isLoading={revokeLoading}
                onConfirm={handleRevokeAll}
                onCancel={revokeAllModal.close}
            />
        </div>
    );
}
