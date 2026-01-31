/**
 * Sessions Page
 */

import { useState, useEffect } from 'react';
import { sessionsApi } from '../../../core/api/rbac.api';
import type { Session } from '../../../core/types/session.types';
import { Search, LogOut, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../core/contexts/AuthContext';
import './SettingsPage.css';

export function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSession, setCurrentSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // In a real app we'd fetch all active sessions for admin
    // For now, we'll just fetch the current user's sessions as an example
    // OR if we had an endpoint for "all active sessions system-wide" we'd use that here.
    // Assuming this page is for admins to view USER sessions, we might need to pick a user first.
    // BUT for simplicity, let's just list the current user's active sessions for now, 
    // or add a "User ID" search input to look up someone's sessions.

    const { user } = useAuth();
    // State for user ID lookup (admin feature)
    const [targetUserId, setTargetUserId] = useState('');

    useEffect(() => {
        // Load current session initially
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
            // The API returns a Axios response, need to check if it's unwrapped or not based on client.ts
            // client.ts interceptor unwraps response.data
            // sessionsApi.getByUser returns response (not response.data) based on rbac.api.ts definition?
            // Let's check rbac.api.ts. 
            // It says: getByUser: async (userId: string) => { const response = ...; return response; },
            // And client.ts unwraps it. So 'response' here is response body from backend.
            // Backend response is { data: Session[], error: null, meta: ... }
            // So response.data is Session[]

            const response = await sessionsApi.getByUser(userId);
            // Verify response structure. The client interceptor returns "response.data".
            // Backend returns { data: ..., error: ..., meta: ... }
            // So if client returns response.data, that is the whole envelope?
            // No, client.ts says: return response.data; 
            // Axios response.data IS the body.
            // So client returns the body: { data: ..., error: ..., meta: ... }

            // Wait, let's look at client.ts again to be sure.
            // "return response.data" -> This is the Body of the response.
            // The Body is { data: T, error: ..., meta: ... }
            // So `response.data` in the component is the `data` field of the envelope? 
            // OR is `response` the envelope?

            // If the interceptor returns `response.data`, then the return value of `apiClient.get` is the body.
            // So `response` variable here IS the body: { data: Session[], ... }

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

    const handleRevoke = async (sessionId: string) => {
        if (!confirm('Are you sure you want to revoke this session? The user will be logged out.')) return;
        try {
            await sessionsApi.revoke(sessionId);
            if (targetUserId) loadUserSessions(targetUserId);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to revoke session');
        }
    };

    const handleRevokeAll = async () => {
        if (!targetUserId) return;
        if (!confirm('Are you sure you want to revoke ALL sessions for this user?')) return;
        try {
            await sessionsApi.revokeAllByUser(targetUserId);
            loadUserSessions(targetUserId);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to revoke sessions');
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
                    <button className="btn btn-danger" onClick={handleRevokeAll} disabled={!sessions.length}>
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

            {error && <div className="error-message">{error}</div>}

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
                                                onClick={() => handleRevoke(session.id)}
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
        </div>
    );
}
