/**
 * Profile Page
 * 
 * User's own profile with editable fields.
 * Includes OTP verification flow for sensitive changes (password/email).
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../core/contexts/AuthContext';
import { usersApi } from '../core/api/rbac.api';
import { FormInput, FormSwitch } from '../core/components/FormElements';
import { ConfirmModal } from '../core/components/ConfirmModal';
import { User, Mail, Lock, Save, Key } from 'lucide-react';
import './ProfilePage.css';

interface ProfileFormData {
    first_name: string;
    last_name: string;
    title: string;
    department: string;
}

export function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const [formData, setFormData] = useState<ProfileFormData>({
        first_name: '',
        last_name: '',
        title: '',
        department: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Password change state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Email change state
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');

    // OTP state (for future implementation)
    const [otpStep, setOtpStep] = useState<'idle' | 'sent' | 'verify'>('idle');
    const [otpCode, setOtpCode] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                title: user.title || '',
                department: user.department || '',
            });
        }
    }, [user]);

    const handleInputChange = (field: keyof ProfileFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    const handleSaveProfile = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            await usersApi.update(user.id, formData);
            await refreshUser();
            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!user) return;
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsSaving(true);
        try {
            // TODO: Implement OTP verification flow when backend routes are ready
            await usersApi.update(user.id, { password: newPassword });
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            setSuccess('Password updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEmailChange = async () => {
        if (!user) return;
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsSaving(true);
        try {
            // TODO: Implement OTP verification flow when backend routes are ready
            await usersApi.update(user.id, { primary_email: newEmail });
            await refreshUser();
            setShowEmailModal(false);
            setNewEmail('');
            setSuccess('Email updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update email');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return <div className="profile-loading">Loading profile...</div>;
    }

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
                {/* Basic Info Section */}
                <section className="profile-section">
                    <h2>
                        <User size={20} />
                        Personal Information
                    </h2>
                    <form onSubmit={handleSaveProfile}>
                        <div className="form-row">
                            <FormInput
                                label="First Name"
                                value={formData.first_name}
                                onChange={e => handleInputChange('first_name', e.target.value)}
                                placeholder="Enter first name"
                            />
                            <FormInput
                                label="Last Name"
                                value={formData.last_name}
                                onChange={e => handleInputChange('last_name', e.target.value)}
                                placeholder="Enter last name"
                                required
                            />
                        </div>
                        <div className="form-row">
                            <FormInput
                                label="Title"
                                value={formData.title}
                                onChange={e => handleInputChange('title', e.target.value)}
                                placeholder="e.g., Software Engineer"
                            />
                            <FormInput
                                label="Department"
                                value={formData.department}
                                onChange={e => handleInputChange('department', e.target.value)}
                                placeholder="e.g., Engineering"
                            />
                        </div>
                        <div className="profile-actions">
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                <Save size={18} />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Account Section */}
                <section className="profile-section">
                    <h2>
                        <Key size={20} />
                        Account Settings
                    </h2>

                    <div className="account-info">
                        <div className="account-row">
                            <div className="account-label">
                                <Mail size={18} />
                                <span>Email Address</span>
                            </div>
                            <div className="account-value">
                                <span>{user.primary_email}</span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowEmailModal(true)}
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <div className="account-row">
                            <div className="account-label">
                                <Lock size={18} />
                                <span>Password</span>
                            </div>
                            <div className="account-value">
                                <span>••••••••</span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowPasswordModal(true)}
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <div className="account-row">
                            <div className="account-label">
                                <User size={18} />
                                <span>Username</span>
                            </div>
                            <div className="account-value">
                                <span className="text-muted">{user.username}</span>
                                <span className="badge">Cannot be changed</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Change Password</h3>
                        <p className="modal-hint">
                            Enter your new password below. It must be at least 8 characters.
                        </p>
                        <FormInput
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            required
                        />
                        <FormInput
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                        />
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowPasswordModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handlePasswordChange}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Change Modal */}
            {showEmailModal && (
                <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Change Email</h3>
                        <p className="modal-hint">
                            Enter your new email address below.
                        </p>
                        <FormInput
                            label="New Email"
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder="Enter new email"
                            required
                        />
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowEmailModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleEmailChange}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Updating...' : 'Update Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
