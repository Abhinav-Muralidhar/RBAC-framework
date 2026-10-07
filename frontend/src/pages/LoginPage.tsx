/**
 * Login / Forgot Password Page
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, KeyRound, RefreshCw } from 'lucide-react';
import { useAuth } from '../core/contexts/useAuth';
import { authApi } from '../core/api/auth.api';
import { useBranding } from '../core/hooks/useBranding';
import { parseApiError, validateOtp, validateConfirmPassword, validatePassword } from '../core/utils';
import { ROUTES } from '../routes/routes';
import './LoginPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ASSET_BASE_URL = API_BASE_URL.replace(/\/v1\/?$/, '');

type AuthView = 'login' | 'forgot';
type ForgotStep = 'email' | 'otp' | 'reset';

const VIEW_CONTENT: Record<AuthView, { eyebrow: string; title: string; description: string }> = {
    login: {
        eyebrow: '',
        title: 'Sign In',
        description: 'Enter your credentials to access your account',
    },
    forgot: {
        eyebrow: 'Password Reset',
        title: 'Recover Account',
        description: 'Enter your email to receive a verification code',
    },
};

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();

    const [view, setView] = useState<AuthView>('login');
    const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loginShake, setLoginShake] = useState(false);
    const { data: branding } = useBranding();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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

    const logoUrl = branding?.company_logo
        ? `${ASSET_BASE_URL}/${branding.company_logo}`
        : null;
    if (authLoading) {
        return (
            <div className="login-page">
                <div className="login-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (isAuthenticated) return null;

    const resetMessages = () => {
        setError('');
        setSuccess('');
    };

    const openForgotFlow = () => {
        resetMessages();
        setForgotStep('email');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setView('forgot');
    };

    const returnToLogin = () => {
        resetMessages();
        setView('login');
    };

    const getStepClassName = (step: ForgotStep) => {
        const isActive = forgotStep === step;
        const isComplete =
            (step === 'email' && (forgotStep === 'otp' || forgotStep === 'reset')) ||
            (step === 'otp' && forgotStep === 'reset');

        return `login-step${isActive ? ' is-active' : isComplete ? ' is-complete' : ''}`;
    };

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        resetMessages();
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
        resetMessages();
        setIsLoading(true);
        try {
            await authApi.sendOtp(email.trim());
            setForgotStep('otp');
            setSuccess(`We sent a verification code to ${email.trim()}.`);
        } catch (err) {
            setError(parseApiError(err instanceof Error ? err.message : 'Failed to send OTP'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: FormEvent) => {
        e.preventDefault();
        resetMessages();

        const otpError = validateOtp(otp);
        if (otpError) {
            setError(otpError);
            return;
        }

        setIsLoading(true);
        try {
            await authApi.verifyOtp(email.trim(), otp.trim().toUpperCase());
            setOtp(otp.trim().toUpperCase());
            setForgotStep('reset');
            setSuccess('Verification complete. Set your new password.');
        } catch (err) {
            setError(parseApiError(err instanceof Error ? err.message : 'Failed to verify OTP'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        resetMessages();
        setIsLoading(true);
        try {
            await authApi.sendOtp(email.trim());
            setSuccess(`A fresh verification code was sent to ${email.trim()}.`);
        } catch (err) {
            setError(parseApiError(err instanceof Error ? err.message : 'Failed to resend OTP'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        resetMessages();

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        const confirmError = validateConfirmPassword(newPassword, confirmPassword);
        if (confirmError) {
            setError(confirmError);
            return;
        }

        setIsLoading(true);
        try {
            await authApi.resetPassword(email.trim(), otp.trim().toUpperCase(), newPassword);
            setSuccess('Password updated successfully. You can sign in now.');
            setView('login');
            setForgotStep('email');
            setPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setOtp('');
        } catch (err) {
            setError(parseApiError(err instanceof Error ? err.message : 'Failed to reset password'));
        } finally {
            setIsLoading(false);
        }
    };

    const currentView = VIEW_CONTENT[view];

    return (
        <div className="login-page">
            <div className={`login-shell${loginShake ? ' login-shake' : ''}`}>
                <div className="login-shell__glow" />

                <section className="login-panel">
                    <div className="login-header">
                        <div className="login-brand">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={`${branding?.company_name || 'Logo'} logo`}
                                    className="login-logo-large"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parent = (e.target as HTMLElement).parentElement;
                                        if (parent) {
                                            parent.classList.add('fallback-icon-active');
                                        }
                                    }}
                                />
                            ) : (
                                <div className="login-logo-icon">
                                    <Shield size={48} strokeWidth={1.5} />
                                </div>
                            )}
                        </div>
                        {currentView.eyebrow && (
                            <span className="login-eyebrow">{currentView.eyebrow}</span>
                        )}
                        <h2>{currentView.title}</h2>
                        <p>{currentView.description}</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}
                    {success && <div className="login-success">{success}</div>}

                    {view !== 'login' && (
                        <button className="link-button login-back" onClick={returnToLogin}>
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
                                onClick={openForgotFlow}
                            >
                                Forgot password?
                            </button>

                            <button className="login-btn" disabled={isLoading}>
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    )}

                    {view === 'forgot' && (
                        <div className="login-recovery">
                            <div className="login-recovery__steps" aria-label="Password recovery steps">
                                <div className={getStepClassName('email')}>
                                    <span className="login-step__icon"><Mail size={16} /></span>
                                    <div>
                                        <strong>Email</strong>
                                        <span>Request code</span>
                                    </div>
                                </div>
                                <div className={getStepClassName('otp')}>
                                    <span className="login-step__icon"><KeyRound size={16} /></span>
                                    <div>
                                        <strong>Verify</strong>
                                        <span>Confirm OTP</span>
                                    </div>
                                </div>
                                <div className={getStepClassName('reset')}>
                                    <span className="login-step__icon"><RefreshCw size={16} /></span>
                                    <div>
                                        <strong>Reset</strong>
                                        <span>Set password</span>
                                    </div>
                                </div>
                            </div>

                            {forgotStep === 'email' && (
                                <form onSubmit={handleSendOtp} className="login-form">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => { setEmail(e.target.value); resetMessages(); }}
                                            required
                                        />
                                    </div>

                                    <button className="login-btn" disabled={isLoading}>
                                        {isLoading ? 'Sending...' : 'Send OTP'}
                                    </button>
                                </form>
                            )}

                            {forgotStep === 'otp' && (
                                <form onSubmit={handleVerifyOtp} className="login-form">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => { setEmail(e.target.value); resetMessages(); }}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>OTP</label>
                                        <input
                                            value={otp}
                                            onChange={e => { setOtp(e.target.value.toUpperCase()); resetMessages(); }}
                                            placeholder="6-digit code"
                                            required
                                        />
                                    </div>

                                    <div className="login-form__actions">
                                        <button type="button" className="link-button" onClick={handleResendOtp} disabled={isLoading}>
                                            Resend code
                                        </button>
                                        <button className="login-btn" disabled={isLoading}>
                                            {isLoading ? 'Verifying...' : 'Verify OTP'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {forgotStep === 'reset' && (
                                <form onSubmit={handleResetPassword} className="login-form">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input type="email" value={email} readOnly />
                                    </div>

                                    <div className="form-group">
                                        <label>OTP</label>
                                        <input value={otp} readOnly />
                                    </div>

                                    <div className="form-group">
                                        <label>New Password</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={e => { setNewPassword(e.target.value); resetMessages(); }}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Confirm Password</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => { setConfirmPassword(e.target.value); resetMessages(); }}
                                            required
                                        />
                                    </div>

                                    <button className="login-btn" disabled={isLoading}>
                                        {isLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* End login section */}
                </section>
            </div>
        </div>
    );
}
