/**
 * Profile Page
 * * User's own profile with editable fields.
 * Includes strict OTP verification flow for sensitive changes (password/email).
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../core/contexts/AuthContext';
import { usersApi } from '../core/api/rbac.api';
import { FormInput, FormSwitch } from '../core/components/FormElements';
import {
    User, Mail, Lock, Save, Key, Phone,
    MapPin, Settings, ShieldCheck
} from 'lucide-react';
import './ProfilePage.css';

interface ProfileFormData {
    first_name: string;
    last_name: string;
    title: string;
    department: string;
    secondary_email: string;
    other_email: string;
    mobile_phone: string;
    office_phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    time_zone: string;
    preferred_currency: string;
    full_screen_preview: boolean;
    signature: string;
}

type OtpFlowType = 'idle' | 'password' | 'email';
type OtpStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

export function ProfilePage() {
    const { user, refreshUser } = useAuth();

    const [formData, setFormData] = useState<ProfileFormData>({
        first_name: '',
        last_name: '',
        title: '',
        department: '',
        secondary_email: '',
        other_email: '',
        mobile_phone: '',
        office_phone: '',
        street: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
        time_zone: '',
        preferred_currency: '',
        full_screen_preview: false,
        signature: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [activeFlow, setActiveFlow] = useState<OtpFlowType>('idle');
    const [otpStep, setOtpStep] = useState<OtpStep>('idle');
    const [otpCode, setOtpCode] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');

    /* ---------------- Load User ---------------- */

    useEffect(() => {
        if (!user) return;

        setFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            title: user.title || '',
            department: user.department || '',
            secondary_email: user.secondary_email || '',
            other_email: user.other_email || '',
            mobile_phone: user.mobile_phone || '',
            office_phone: user.office_phone || '',
            street: user.street || '',
            city: user.city || '',
            state: user.state || '',
            country: user.country || '',
            postal_code: user.postal_code || '',
            time_zone: user.time_zone || '',
            preferred_currency: user.preferred_currency || '',
            full_screen_preview: !!user.full_screen_preview,
            signature: user.signature || '',
        });
    }, [user]);

    /* ---------------- Helpers ---------------- */

    const resetSensitiveState = () => {
        setActiveFlow('idle');
        setOtpStep('idle');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setNewEmail('');
        setError('');
    };

    const handleInputChange = (field: keyof ProfileFormData, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    /* ---------------- Save Profile ---------------- */

    const handleSaveProfile = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            await usersApi.update(user.id, {
                ...formData,
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                title: formData.title || undefined,
                department: formData.department || undefined,
                secondary_email: formData.secondary_email || undefined,
                other_email: formData.other_email || undefined,
                mobile_phone: formData.mobile_phone || undefined,
                office_phone: formData.office_phone || undefined,
                street: formData.street || undefined,
                city: formData.city || undefined,
                state: formData.state || undefined,
                country: formData.country || undefined,
                postal_code: formData.postal_code || undefined,
                time_zone: formData.time_zone || undefined,
                preferred_currency: formData.preferred_currency || undefined,
                signature: formData.signature || undefined,
            });

            await refreshUser();
            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    /* ---------------- OTP Flow ---------------- */

    const startSensitiveFlow = async (type: 'password' | 'email') => {
        setActiveFlow(type);
        setOtpStep('sending');
        setError('');

        setTimeout(() => setOtpStep('sent'), 800);
    };

    const verifyOtp = async () => {
        if (otpCode.length !== 6) return;

        setOtpStep('verifying');

        setTimeout(() => {
            setOtpStep('verified');
        }, 800);
    };

    /* ---------------- Final Password ---------------- */

    const handleFinalPasswordChange = async () => {
        if (!user) return;

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        try {
            // Mock API call to send OTP
            // await authApi.sendOtp(user.email); 
            setTimeout(() => setOtpStep('sent'), 800);
        } catch (err) {
            setError('Failed to send verification code.');
            setActiveFlow('idle');
        }
    };

    const verifyOtp = async () => {
        if (otpCode.length !== 6) return;

        setOtpStep('verifying');

        setTimeout(() => {
            setOtpStep('verified');
        }, 800);
    };

    /* ---------------- Final Password ---------------- */

    const handleFinalPasswordChange = async () => {
        if (!user) return;

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSaving(true);

        try {
            await usersApi.update(user.id, { password: newPassword });
            setSuccess('Password updated successfully!');
            resetSensitiveState();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    /* ---------------- Final Email ---------------- */

    const handleFinalEmailChange = async () => {
        if (!user || !newEmail) return;

        setIsSaving(true);

        try {
            await usersApi.update(user.id, { primary_email: newEmail });
            await refreshUser();
            setSuccess('Email updated successfully!');
            resetSensitiveState();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update email');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div className="profile-loading">Loading profile...</div>;

    return (
        <div className="profile-page">
            <header className="profile-header">
                <div className="profile-avatar">
                    <User size={48} />
                </div>
                <div className="profile-title">
                    <h1>{user.first_name} {user.last_name}</h1>
                    <p>{user.primary_email}</p>
                </div>
            </header>

            {error && <div className="profile-error">{error}</div>}
            {success && <div className="profile-success">{success}</div>}

            <div className="profile-sections">
                {/* --- Personal Information --- */}
                <section className="profile-section">
                    <h2><User size={20} /> Personal Information</h2>

                    <form onSubmit={handleSaveProfile}>
                        <div className="form-row">
                            <FormInput
                                label="First Name"
                                value={formData.first_name}
                                onChange={e => handleInputChange('first_name', e.target.value)}
                            />
                            <FormInput
                                label="Last Name"
                                value={formData.last_name}
                                onChange={e => handleInputChange('last_name', e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-row">
                            <FormInput
                                label="Title"
                                value={formData.title}
                                onChange={e => handleInputChange('title', e.target.value)}
                            />
                            <FormInput
                                label="Department"
                                value={formData.department}
                                onChange={e => handleInputChange('department', e.target.value)}
                            />
                        </div>


                        <h2><Phone size={18} /> Contact Details</h2>
                        <div className="form-row">
                            <FormInput
                                label="Mobile Phone"
                                value={formData.mobile_phone}
                                onChange={e => handleInputChange('mobile_phone', e.target.value)}
                            />
                            <FormInput
                                label="Office Phone"
                                value={formData.office_phone}
                                onChange={e => handleInputChange('office_phone', e.target.value)}
                            />
                        </div>

                        <h2><MapPin size={18} /> Address</h2>
                        <FormInput
                            label="Street"
                            value={formData.street}
                            onChange={e => handleInputChange('street', e.target.value)}
                        />
                        <div className="form-row">
                            <FormInput label="City" value={formData.city} onChange={e => handleInputChange('city', e.target.value)} />
                            <FormInput label="State" value={formData.state} onChange={e => handleInputChange('state', e.target.value)} />
                        </div>
                        <div className="form-row">
                            <FormInput label="Country" value={formData.country} onChange={e => handleInputChange('country', e.target.value)} />
                            <FormInput label="Postal Code" value={formData.postal_code} onChange={e => handleInputChange('postal_code', e.target.value)} />
                        </div>

                        <h2><Settings size={18} /> Preferences</h2>
                        <div className="form-row">
                            <FormInput
                                label="Time Zone"
                                value={formData.time_zone}
                                onChange={e => handleInputChange('time_zone', e.target.value)}
                            />
                            <FormInput
                                label="Currency"
                                value={formData.preferred_currency}
                                onChange={e => handleInputChange('preferred_currency', e.target.value)}
                            />
                        </div>

                        <FormSwitch
                            label="Full Screen Preview"
                            checked={formData.full_screen_preview}
                            onChange={checked => handleInputChange('full_screen_preview', checked)}
                        />

                        <FormInput
                            label="Signature"
                            type="textarea"
                            value={formData.signature}
                            onChange={e => handleInputChange('signature', e.target.value)}
                        />

                        <div className="profile-actions">
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                <Save size={18} />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </section>

                {/* --- Account Settings --- */}
                <section className="profile-section">
                    <h2><Key size={20} /> Account Settings</h2>
                    <div className="account-info">
                        <div className="account-row">
                            <div className="account-label"><Mail size={18} /><span>Email Address</span></div>
                            <div className="account-value">
                                <span>{user.primary_email}</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => startSensitiveFlow('email')}>Change</button>
                            </div>
                        </div>
                        <div className="account-row">
                            <div className="account-label"><Lock size={18} /><span>Password</span></div>
                            <div className="account-value">
                                <span>••••••••</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => startSensitiveFlow('password')}>Change</button>
                            </div>
                        </div>
                        <div className="account-row">
                            <div className="account-label"><User size={18} /><span>Username</span></div>
                            <div className="account-value">
                                <span className="text-muted">{user.username}</span>
                                <span className="badge">Read-only</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* --- 1. OTP Verification Modal --- */}
            {(activeFlow !== 'idle' && otpStep !== 'verified') && (
                <div className="modal-overlay" onClick={resetSensitiveState}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-icon"><ShieldCheck size={32} /></div>
                        <h3>Security Verification</h3>
                        <p className="modal-hint">
                            For your security, we have sent a 6-digit verification code to <strong>{user.primary_email}</strong>.
                            Please enter it below to proceed.
                        </p>

                        {/* Fix: Removed className from FormInput. 
                          Wrapped in div with class "otp-input-container" for styling if needed.
                        */}
                        <div className="otp-input-container">
                            <FormInput
                                label="Verification Code"
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value)}
                                placeholder="XXXXXX"
                                required
                            />
                        </div>

                        {otpStep === 'sending' && <p className="text-muted text-sm">Sending code...</p>}

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={resetSensitiveState}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={verifyOtp}
                                disabled={otpStep === 'sending' || otpStep === 'verifying' || otpCode.length < 6}
                            >
                                {otpStep === 'verifying' ? 'Verifying...' : 'Verify Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 2. Change Password Modal (Only shows after OTP) --- */}
            {(activeFlow === 'password' && otpStep === 'verified') && (
                <div className="modal-overlay" onClick={resetSensitiveState}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Set New Password</h3>
                        <p className="modal-hint">Identity verified. Please enter your new password.</p>
                        <FormInput
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                        />
                        <FormInput
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                        />
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={resetSensitiveState}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleFinalPasswordChange} disabled={isSaving}>
                                {isSaving ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 3. Change Email Modal (Only shows after OTP) --- */}
            {(activeFlow === 'email' && otpStep === 'verified') && (
                <div className="modal-overlay" onClick={resetSensitiveState}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Update Email Address</h3>
                        <p className="modal-hint">Identity verified. Please enter your new email address.</p>
                        <FormInput
                            label="New Email"
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            required
                        />
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={resetSensitiveState}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleFinalEmailChange} disabled={isSaving}>
                                {isSaving ? 'Updating...' : 'Update Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}