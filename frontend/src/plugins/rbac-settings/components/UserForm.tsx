/**
 * User Form Component
 * 
 * Create/Edit user form used in FormModal.
 * Uses centralized validators for password and email.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSwitch } from '../../../core/components/FormElements';
import type { User, CreateUserDto, UpdateUserDto } from '../../../core/types/user.types';
import type { Role } from '../../../core/types/role.types';
import { usersApi, rolesApi, landingPagesApi, type LandingPageOption } from '../../../core/api/rbac.api';
import {
    NAME_FORMAT_OPTIONS,
    TIME_ZONE_OPTIONS,
    CURRENCY_OPTIONS,
    SYMBOL_PLACEMENT_OPTIONS,
    TRAILING_ZERO_OPTIONS,
} from '../../../core/constants/userPreferences';
import {
    validateEmail,
    validatePassword,
    validateRequired,
    validateUsername,
    scrollToFirstError,
    parseApiError
} from '../../../core/utils';

interface UserFormProps {
    user?: User | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function UserForm({ user, onSuccess, onError, setLoading }: UserFormProps) {
    const isEditing = !!user;

    const [formData, setFormData] = useState({
        // Required
        username: user?.username || '',
        primary_email: user?.primary_email || '',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        password: '',
        status: (user?.status || 'active') as 'active' | 'inactive',

        // Personal
        title: user?.title || '',
        department: user?.department || '',

        // Contact
        secondary_email: user?.secondary_email || '',
        other_email: user?.other_email || '',
        office_phone: user?.office_phone || '',
        mobile_phone: user?.mobile_phone || '',
        home_phone: user?.home_phone || '',
        secondary_phone: user?.secondary_phone || '',
        fax: user?.fax || '',

        // Address
        street: user?.street || '',
        city: user?.city || '',
        state: user?.state || '',
        country: user?.country || '',
        postal_code: user?.postal_code || '',

        // Preferences
        default_landing_page: user?.default_landing_page || '',
        name_format: user?.name_format || '',
        phone_country_code: user?.phone_country_code || '',
        full_screen_preview: !!user?.full_screen_preview,
        time_zone: user?.time_zone || '',

        // Currency
        preferred_currency: user?.preferred_currency || '',
        digit_grouping_pattern: user?.digit_grouping_pattern || '',
        decimal_separator: user?.decimal_separator || '',
        decimal_precision: user?.decimal_precision?.toString() || '',
        symbol_placement: user?.symbol_placement || '',
        trailing_zero_handling: user?.trailing_zero_handling || '',

        // Other
        aggregation_format: user?.aggregation_format || '',
        signature: user?.signature || '',
    });

    // Role dropdown
    const [selectedRole, setSelectedRole] = useState<string>(user?.rolesid || '');
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [roleSearch, setRoleSearch] = useState('');
    const [roleSearchLoading, setRoleSearchLoading] = useState(false);
    const [isSearchingRoles, setIsSearchingRoles] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [roleSearchTimer, setRoleSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Reports-to user dropdown
    const [reportsToUserId, setReportsToUserId] = useState<string>(user?.reports_to_user_id || '');
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [userSearchTimer, setUserSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Landing pages
    const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // =================== EFFECTS ===================

    // Load landing pages on mount
    useEffect(() => {
        landingPagesApi.list().then(setLandingPages).catch(() => { });
    }, []);

    // Load roles (debounced search)
    useEffect(() => {
        if (roleSearchTimer) clearTimeout(roleSearchTimer);
        if (isSearchingRoles) {
            const timer = setTimeout(() => loadRoles(roleSearch), 300);
            setRoleSearchTimer(timer);
            return () => { if (timer) clearTimeout(timer); };
        }
    }, [roleSearch, isSearchingRoles]);

    // Load users for reports-to (debounced search)
    useEffect(() => {
        if (userSearchTimer) clearTimeout(userSearchTimer);
        if (isSearchingUsers) {
            const timer = setTimeout(() => loadUsers(userSearch), 300);
            setUserSearchTimer(timer);
            return () => { if (timer) clearTimeout(timer); };
        }
    }, [userSearch, isSearchingUsers]);

    // Initial loads
    useEffect(() => { loadRoles(''); loadUsers(''); }, []);

    // Keep state in sync with props
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                primary_email: user.primary_email || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                password: '',
                status: (user.status || 'active') as 'active' | 'inactive',
                title: user.title || '',
                department: user.department || '',
                secondary_email: user.secondary_email || '',
                other_email: user.other_email || '',
                office_phone: user.office_phone || '',
                mobile_phone: user.mobile_phone || '',
                home_phone: user.home_phone || '',
                secondary_phone: user.secondary_phone || '',
                fax: user.fax || '',
                street: user.street || '',
                city: user.city || '',
                state: user.state || '',
                country: user.country || '',
                postal_code: user.postal_code || '',
                default_landing_page: user.default_landing_page || '',
                name_format: user.name_format || '',
                phone_country_code: user.phone_country_code || '',
                full_screen_preview: !!user.full_screen_preview,
                time_zone: user.time_zone || '',
                preferred_currency: user.preferred_currency || '',
                digit_grouping_pattern: user.digit_grouping_pattern || '',
                decimal_separator: user.decimal_separator || '',
                decimal_precision: user.decimal_precision?.toString() || '',
                symbol_placement: user.symbol_placement || '',
                trailing_zero_handling: user.trailing_zero_handling || '',
                aggregation_format: user.aggregation_format || '',
                signature: user.signature || '',
            });
            setSelectedRole(user.rolesid || '');
            setReportsToUserId(user.reports_to_user_id || '');
        }
    }, [user]);

    // =================== LOADERS ===================

    const loadRoles = async (searchQuery: string) => {
        setRoleSearchLoading(true);
        try {
            const response = await rolesApi.list({ limit: 100, search: searchQuery || undefined });
            setAvailableRoles(response.data || []);
        } catch (err) {
            console.error('Failed to load roles', err);
        } finally {
            setRoleSearchLoading(false);
        }
    };

    const loadUsers = async (searchQuery: string) => {
        setUserSearchLoading(true);
        try {
            const response = await usersApi.list({ limit: 100, search: searchQuery || undefined });
            // Exclude the current user being edited
            const users = (response.data || []).filter(u => !user || u.id !== user.id);
            setAvailableUsers(users);
        } catch (err) {
            console.error('Failed to load users', err);
        } finally {
            setUserSearchLoading(false);
        }
    };

    // =================== HANDLERS ===================

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    // --- Role dropdown ---
    const getRoleDisplayValue = () => {
        if (isSearchingRoles) return roleSearch;
        if (selectedRole) {
            const role = availableRoles.find(r => r.id === selectedRole);
            return role?.name || '';
        }
        return '';
    };

    const handleRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoleSearch(e.target.value);
        setIsSearchingRoles(true);
        if (!e.target.value) setSelectedRole('');
    };

    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setRoleSearch('');
        setIsSearchingRoles(false);
        setRoleDropdownOpen(false);
    };

    // --- Reports-to dropdown ---
    const getReportsToDisplayValue = () => {
        if (isSearchingUsers) return userSearch;
        if (reportsToUserId) {
            const u = availableUsers.find(u => u.id === reportsToUserId);
            return u ? `${u.first_name || ''} ${u.last_name} (${u.primary_email})`.trim() : '';
        }
        return '';
    };

    const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUserSearch(e.target.value);
        setIsSearchingUsers(true);
        if (!e.target.value) setReportsToUserId('');
    };

    const handleUserSelect = (userId: string) => {
        setReportsToUserId(userId);
        setUserSearch('');
        setIsSearchingUsers(false);
        setUserDropdownOpen(false);
    };

    // =================== VALIDATION ===================

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!isEditing) {
            const usernameErr = validateUsername(formData.username);
            if (usernameErr) newErrors.username = usernameErr;
        }

        const emailErr = validateEmail(formData.primary_email);
        if (emailErr) newErrors.primary_email = emailErr;

        const lastNameErr = validateRequired(formData.last_name, 'Last name');
        if (lastNameErr) newErrors.last_name = lastNameErr;

        if (!isEditing) {
            const passwordErr = validatePassword(formData.password);
            if (passwordErr) newErrors.password = passwordErr;
        } else if (formData.password) {
            const passwordErr = validatePassword(formData.password);
            if (passwordErr) newErrors.password = passwordErr;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // =================== SUBMIT ===================

    const handleSubmit = async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            const commonFields = {
                primary_email: formData.primary_email,
                first_name: formData.first_name || undefined,
                last_name: formData.last_name,
                title: formData.title || undefined,
                department: formData.department || undefined,
                reports_to_user_id: reportsToUserId || undefined,
                secondary_email: formData.secondary_email || undefined,
                other_email: formData.other_email || undefined,
                office_phone: formData.office_phone || undefined,
                mobile_phone: formData.mobile_phone || undefined,
                home_phone: formData.home_phone || undefined,
                secondary_phone: formData.secondary_phone || undefined,
                fax: formData.fax || undefined,
                street: formData.street || undefined,
                city: formData.city || undefined,
                state: formData.state || undefined,
                country: formData.country || undefined,
                postal_code: formData.postal_code || undefined,
                default_landing_page: formData.default_landing_page || undefined,
                name_format: formData.name_format || undefined,
                phone_country_code: formData.phone_country_code || undefined,
                full_screen_preview: formData.full_screen_preview,
                time_zone: formData.time_zone || undefined,
                preferred_currency: formData.preferred_currency || undefined,
                digit_grouping_pattern: formData.digit_grouping_pattern || undefined,
                decimal_separator: formData.decimal_separator || undefined,
                decimal_precision: formData.decimal_precision ? parseInt(formData.decimal_precision, 10) : undefined,
                symbol_placement: (formData.symbol_placement as 'before' | 'after') || undefined,
                trailing_zero_handling: (formData.trailing_zero_handling as 'show' | 'hide') || undefined,
                aggregation_format: formData.aggregation_format || undefined,
                signature: formData.signature || undefined,
                rolesid: selectedRole,
            };

            if (isEditing && user) {
                const updateData: UpdateUserDto = {
                    ...commonFields,
                    status: formData.status,
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                await usersApi.update(user.id, updateData);
            } else {
                const createData: CreateUserDto = {
                    ...commonFields,
                    username: formData.username,
                    password: formData.password,
                    rolesid: selectedRole,
                };
                await usersApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save user'));
        } finally {
            setLoading(false);
        }
    };

    // =================== DROPDOWN STYLES ===================

    const dropdownStyle: React.CSSProperties = {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        maxHeight: '200px',
        overflowY: 'auto',
        border: '1px solid var(--border-primary, #ccc)',
        backgroundColor: 'var(--bg-primary, white)',
        zIndex: 1000,
        borderRadius: '0 0 6px 6px',
    };

    const dropdownItemStyle = (isSelected: boolean, isDisabled: boolean): React.CSSProperties => ({
        padding: '0.5rem 0.75rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        color: isDisabled ? 'var(--text-muted, #999)' : 'var(--text-primary, #000)',
        backgroundColor: isSelected ? 'var(--bg-hover, #e3f2fd)' : 'transparent',
    });

    // =================== RENDER ===================

    return (
        <div className="entity-form">

            {/* === Account Basics === */}
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</h3>
            <div className="form-row">
                <FormInput
                    label="Username"
                    value={formData.username}
                    onChange={e => handleChange('username', e.target.value)}
                    error={errors.username}
                    disabled={isEditing}
                    required
                    hint={!isEditing ? "Letters, numbers, and underscores only" : undefined}
                />
                <FormInput
                    label="Email"
                    type="email"
                    value={formData.primary_email}
                    onChange={e => handleChange('primary_email', e.target.value)}
                    error={errors.primary_email}
                    required
                />
            </div>

            <div className="form-row">
                <FormSwitch
                    label="Active"
                    checked={formData.status === 'active'}
                    onChange={checked => handleChange('status', checked ? 'active' : 'inactive')}
                    hint="Inactive profiles cannot be assigned"
                />
                <FormInput
                    label={isEditing ? 'New Password (optional)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    error={errors.password}
                    required={!isEditing}
                />
            </div>

            {/* === Personal === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Information</h3>
            <div className="form-row">
                <FormInput label="First Name" value={formData.first_name} onChange={e => handleChange('first_name', e.target.value)} />
                <FormInput label="Last Name" value={formData.last_name} onChange={e => handleChange('last_name', e.target.value)} error={errors.last_name} required />
            </div>
            <div className="form-row">
                <FormInput label="Title" value={formData.title} onChange={e => handleChange('title', e.target.value)} />
                <FormInput label="Department" value={formData.department} onChange={e => handleChange('department', e.target.value)} />
            </div>

            {/* === Contact === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Details</h3>
            <div className="form-row">
                <FormInput label="Secondary Email" type="email" value={formData.secondary_email} onChange={e => handleChange('secondary_email', e.target.value)} />
                <FormInput label="Other Email" type="email" value={formData.other_email} onChange={e => handleChange('other_email', e.target.value)} />
            </div>
            <div className="form-row">
                <FormInput label="Office Phone" value={formData.office_phone} onChange={e => handleChange('office_phone', e.target.value)} />
                <FormInput label="Mobile Phone" value={formData.mobile_phone} onChange={e => handleChange('mobile_phone', e.target.value)} />
            </div>
            <div className="form-row">
                <FormInput label="Home Phone" value={formData.home_phone} onChange={e => handleChange('home_phone', e.target.value)} />
                <FormInput label="Secondary Phone" value={formData.secondary_phone} onChange={e => handleChange('secondary_phone', e.target.value)} />
            </div>
            <div className="form-row">
                <FormInput label="Fax" value={formData.fax} onChange={e => handleChange('fax', e.target.value)} />
                <FormInput label="Phone Country Code" value={formData.phone_country_code} onChange={e => handleChange('phone_country_code', e.target.value)} hint="e.g. +91, +1" />
            </div>

            {/* === Address === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</h3>
            <FormInput label="Street" value={formData.street} onChange={e => handleChange('street', e.target.value)} />
            <div className="form-row">
                <FormInput label="City" value={formData.city} onChange={e => handleChange('city', e.target.value)} />
                <FormInput label="State" value={formData.state} onChange={e => handleChange('state', e.target.value)} />
            </div>
            <div className="form-row">
                <FormInput label="Country" value={formData.country} onChange={e => handleChange('country', e.target.value)} />
                <FormInput label="Postal Code" value={formData.postal_code} onChange={e => handleChange('postal_code', e.target.value)} />
            </div>

            {/* === Preferences === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferences</h3>
            <div className="form-row">
                {/* Default Landing Page dropdown */}
                <div className="form-field">
                    <label className="form-label">Default Landing Page</label>
                    <select
                        value={formData.default_landing_page}
                        onChange={e => handleChange('default_landing_page', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— None (Dashboard) —</option>
                        {landingPages.map(lp => (
                            <option key={lp.key} value={lp.key}>{lp.label}</option>
                        ))}
                    </select>
                </div>

                {/* Name Format dropdown */}
                <div className="form-field">
                    <label className="form-label">Name Format</label>
                    <select
                        value={formData.name_format}
                        onChange={e => handleChange('name_format', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— Not Set —</option>
                        {NAME_FORMAT_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="form-row">
                {/* Time Zone dropdown */}
                <div className="form-field">
                    <label className="form-label">Time Zone</label>
                    <select
                        value={formData.time_zone}
                        onChange={e => handleChange('time_zone', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— Not Set —</option>
                        {TIME_ZONE_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <FormSwitch
                    label="Full Screen Preview"
                    checked={formData.full_screen_preview}
                    onChange={checked => handleChange('full_screen_preview', checked)}
                    hint="Opens app in browser fullscreen (like F11)"
                />
            </div>

            {/* === Currency / Number Settings === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Currency & Number Settings</h3>
            <div className="form-row">
                {/* Currency dropdown */}
                <div className="form-field">
                    <label className="form-label">Preferred Currency</label>
                    <select
                        value={formData.preferred_currency}
                        onChange={e => handleChange('preferred_currency', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— Not Set —</option>
                        {CURRENCY_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <FormInput label="Digit Grouping Pattern" value={formData.digit_grouping_pattern} onChange={e => handleChange('digit_grouping_pattern', e.target.value)} hint="e.g. 123,456,789" />
            </div>
            <div className="form-row">
                <FormInput label="Decimal Separator" value={formData.decimal_separator} onChange={e => handleChange('decimal_separator', e.target.value)} hint="e.g. . or ," />
                <FormInput label="Decimal Precision" value={formData.decimal_precision} onChange={e => handleChange('decimal_precision', e.target.value)} hint="Number of decimal places" />
            </div>
            <div className="form-row">
                {/* Symbol Placement dropdown */}
                <div className="form-field">
                    <label className="form-label">Symbol Placement</label>
                    <select
                        value={formData.symbol_placement}
                        onChange={e => handleChange('symbol_placement', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— Not Set —</option>
                        {SYMBOL_PLACEMENT_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* Trailing Zero dropdown */}
                <div className="form-field">
                    <label className="form-label">Trailing Zeros</label>
                    <select
                        value={formData.trailing_zero_handling}
                        onChange={e => handleChange('trailing_zero_handling', e.target.value)}
                        className="form-select"
                    >
                        <option value="">— Not Set —</option>
                        {TRAILING_ZERO_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* === Other === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Other</h3>
            <FormInput label="Aggregation Format" value={formData.aggregation_format} onChange={e => handleChange('aggregation_format', e.target.value)} />
            <FormInput label="Signature" type="textarea" value={formData.signature} onChange={e => handleChange('signature', e.target.value)} />

            {/* === Role Dropdown === */}
            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignment</h3>

            <div className="form-field" style={{ position: 'relative' }}>
                <label className="form-label">Assign Role</label>
                <input
                    type="text"
                    placeholder="Search and select a role..."
                    value={getRoleDisplayValue()}
                    onChange={handleRoleInputChange}
                    onFocus={() => setRoleDropdownOpen(true)}
                    onBlur={() => setTimeout(() => { setRoleDropdownOpen(false); setIsSearchingRoles(false); setRoleSearch(''); }, 200)}
                    className="form-input"
                    autoComplete="off"
                />
                {roleDropdownOpen && (
                    <div className="dropdown-options" style={dropdownStyle}>
                        {roleSearchLoading ? (
                            <div style={{ padding: '0.5rem', color: '#999' }}>Loading...</div>
                        ) : (
                            <>
                                {availableRoles.map(role => {
                                    const isCurrent = role.id === user?.rolesid;
                                    const isSelected = role.id === selectedRole;
                                    return (
                                        <div
                                            key={role.id}
                                            style={dropdownItemStyle(isSelected, isCurrent)}
                                            onMouseDown={e => { e.preventDefault(); if (!isCurrent) handleRoleSelect(role.id); }}
                                        >
                                            {role.name} {isCurrent && '(Current)'} {isSelected && '✓'}
                                        </div>
                                    );
                                })}
                                {availableRoles.length === 0 && (
                                    <div style={{ padding: '0.5rem', color: '#999' }}>No roles found</div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* === Reports To Dropdown === */}
            <div className="form-field" style={{ position: 'relative', marginTop: '0.75rem' }}>
                <label className="form-label">Reports To</label>
                <input
                    type="text"
                    placeholder="Search for a manager..."
                    value={getReportsToDisplayValue()}
                    onChange={handleUserInputChange}
                    onFocus={() => setUserDropdownOpen(true)}
                    onBlur={() => setTimeout(() => { setUserDropdownOpen(false); setIsSearchingUsers(false); setUserSearch(''); }, 200)}
                    className="form-input"
                    autoComplete="off"
                />
                {reportsToUserId && (
                    <button
                        type="button"
                        onClick={() => { setReportsToUserId(''); setUserSearch(''); }}
                        style={{ position: 'absolute', right: '8px', top: '32px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}
                        title="Clear"
                    >
                        ✕
                    </button>
                )}
                {userDropdownOpen && (
                    <div className="dropdown-options" style={dropdownStyle}>
                        {userSearchLoading ? (
                            <div style={{ padding: '0.5rem', color: '#999' }}>Loading...</div>
                        ) : (
                            <>
                                {availableUsers.map(u => {
                                    const isSelected = u.id === reportsToUserId;
                                    return (
                                        <div
                                            key={u.id}
                                            style={dropdownItemStyle(isSelected, false)}
                                            onMouseDown={e => { e.preventDefault(); handleUserSelect(u.id); }}
                                        >
                                            {u.first_name || ''} {u.last_name} ({u.primary_email}) {isSelected && '✓'}
                                        </div>
                                    );
                                })}
                                {availableUsers.length === 0 && (
                                    <div style={{ padding: '0.5rem', color: '#999' }}>No users found</div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden submit button */}
            <button
                type="button"
                id="user-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

/** Trigger submit from FormModal */
export function submitUserForm() {
    document.getElementById('user-form-submit')?.click();
}
