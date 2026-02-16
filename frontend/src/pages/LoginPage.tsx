/**
 * Login / Forgot Password Page
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { useAuth } from '../core/contexts/AuthContext';
import { authApi, organizationApi } from '../core/api/rbac.api';
import type { OrganizationBrandingDto } from '../core/types/organization.types';
import { parseApiError } from '../core/utils';
import { ROUTES } from '../routes/routes';
import './LoginPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type AuthView = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();

    const [view, setView] = useState<AuthView>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loginShake, setLoginShake] = useState(false);
    const [branding, setBranding] = useState<OrganizationBrandingDto | null>(null);

    // Login
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Forgot password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            const landing = user?.default_landing_page || ROUTES.DASHBOARD;
            navigate(landing, { replace: true });
        }
    }, [authLoading, isAuthenticated, navigate, user]);

    useEffect(() => {
        organizationApi.getBranding().then(setBranding).catch(() => { });
    }, []);

    const logoUrl = branding?.company_logo
        ? `${API_BASE_URL}/${branding.company_logo}`
        : null;

    if (authLoading || isAuthenticated) return null;

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoginShake(false);
        setIsLoading(true);
        try {
            const loggedInUser = await login(username, password);
            const landing = loggedInUser?.default_landing_page || ROUTES.DASHBOARD;
            navigate(landing, { replace: true });
        } catch (err) {
            const msg = parseApiError(err instanceof Error ? err.message : 'Login failed');
            setError(msg);
            setLoginShake(true);
            setTimeout(() => setLoginShake(false), 600);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOtp = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await authApi.sendOtp(email);
            setView('forgot-otp');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await authApi.verifyOtp(email, otp);
            setView('forgot-reset');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            await authApi.resetPassword(email, otp, newPassword);
            setView('login');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className={`login-card${loginShake ? ' login-shake' : ''}`}>
                <div className="login-header">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="login-logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    ) : (
                        <Shield size={48} className="login-logo" />
                    )}
                    <h1>{branding?.company_name || 'RBAC Framework'}</h1>
                    <p>
                        {view === 'login' && 'Sign in to your account'}
                        {view === 'forgot-email' && 'Reset your password'}
                        {view === 'forgot-otp' && 'Verify OTP'}
                        {view === 'forgot-reset' && 'Set new password'}
                    </p>
                </div>

                {error && <div className="login-error">{error}</div>}

                {view !== 'login' && (
                    <button className="link-button" onClick={() => setView('login')}>
                        <ArrowLeft size={16} /> Back to login
                    </button>
                )}

                {view === 'login' && (
                    <form onSubmit={handleLogin} className="login-form">
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                className={error && view === 'login' ? 'input-error' : ''}
                                value={username}
                                onChange={e => { setUsername(e.target.value); setError(''); }}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                className={error && view === 'login' ? 'input-error' : ''}
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                required
                            />
                        </div>

                        <button
                            type="button"
                            className="link-button"
                            onClick={() => setView('forgot-email')}
                        >
                            Forgot password?
                        </button>

                        <button className="login-btn" disabled={isLoading}>
                            {isLoading ? 'Signing in…' : 'Sign In'}
                        </button>


                    </form>
                )}

                {view === 'forgot-email' && (
                    <form onSubmit={handleSendOtp} className="login-form">
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button className="login-btn" disabled={isLoading}>
                            Send OTP
                        </button>
                    </form>
                )}

                {view === 'forgot-otp' && (
                    <form onSubmit={handleVerifyOtp} className="login-form">
                        <div className="form-group">
                            <label>OTP</label>
                            <input
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                placeholder="6-digit code"
                                required
                            />
                        </div>

                        <button className="login-btn" disabled={isLoading}>
                            Verify OTP
                        </button>
                    </form>
                )}

                {view === 'forgot-reset' && (
                    <form onSubmit={handleResetPassword} className="login-form">
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button className="login-btn" disabled={isLoading}>
                            Update Password
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
