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
import { usersApi, rolesApi } from '../../../core/api/rbac.api';
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
        username: user?.username || '',
        primary_email: user?.primary_email || '',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        title: user?.title || '',
        department: user?.department || '',
        status: (user?.status || 'active') as 'active' | 'inactive',
        password: '',
    });

    const [selectedRole, setSelectedRole] = useState<string>(
        user?.rolesid || ''
    );

    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [roleSearch, setRoleSearch] = useState('');
    const [roleSearchLoading, setRoleSearchLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Debounce timer for role search
    const [roleSearchTimer, setRoleSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Load roles on mount and when search changes (debounced)
    useEffect(() => {
        // Clear any existing timer
        if (roleSearchTimer) {
            clearTimeout(roleSearchTimer);
        }

        // Only search if user is actively searching
        if (isSearching) {
            const timer = setTimeout(() => {
                loadRoles(roleSearch);
            }, 300); // 300ms debounce

            setRoleSearchTimer(timer);

            return () => {
                if (timer) clearTimeout(timer);
            };
        }
    }, [roleSearch, isSearching]);

    // Initial load
    useEffect(() => {
        loadRoles('');
    }, []);

    // Keep state in sync with props
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                primary_email: user.primary_email || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                title: user.title || '',
                department: user.department || '',
                status: (user.status || 'active') as 'active' | 'inactive',
                password: '',
            });
            setSelectedRole(user.rolesid || '');
        }
    }, [user]);

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

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Get display value for the input
    const getDisplayValue = () => {
        if (isSearching) {
            return roleSearch;
        }
        if (selectedRole) {
            const role = availableRoles.find(r => r.id === selectedRole);
            return role?.name || '';
        }
        return '';
    };

    // Handle input change
    const handleRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setRoleSearch(value);
        setIsSearching(true);

        // If user clears the input, also clear the selection
        if (!value) {
            setSelectedRole('');
        }
    };

    // Handle role selection
    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setRoleSearch('');
        setIsSearching(false);
        setDropdownOpen(false);
    };

    // Handle input focus
    const handleRoleInputFocus = () => {
        setDropdownOpen(true);
        // Don't set isSearching here - let the user see current selection
    };

    // Handle input blur with delay to allow clicking dropdown items
    const handleRoleInputBlur = () => {
        setTimeout(() => {
            setDropdownOpen(false);
            setIsSearching(false);
            setRoleSearch('');
        }, 200);
    };

    // ---------------- VALIDATION ----------------

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

    // ---------------- SUBMIT ----------------

    const handleSubmit = async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            if (isEditing && user) {
                const updateData: UpdateUserDto = {
                    primary_email: formData.primary_email,
                    first_name: formData.first_name || undefined,
                    last_name: formData.last_name,
                    title: formData.title || undefined,
                    department: formData.department || undefined,
                    status: formData.status,
                    rolesid: selectedRole,
                };

                if (formData.password) {
                    updateData.password = formData.password;
                }

                await usersApi.update(user.id, updateData);
            } else {
                const createData: CreateUserDto = {
                    username: formData.username,
                    password: formData.password,
                    primary_email: formData.primary_email,
                    first_name: formData.first_name || undefined,
                    last_name: formData.last_name,
                    title: formData.title || undefined,
                    department: formData.department || undefined,
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

    // ---------------- UI ----------------

    return (
        <div className="entity-form">

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
                <FormInput
                    label="First Name"
                    value={formData.first_name}
                    onChange={e => handleChange('first_name', e.target.value)}
                />

                <FormInput
                    label="Last Name"
                    value={formData.last_name}
                    onChange={e => handleChange('last_name', e.target.value)}
                    error={errors.last_name}
                    required
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Title"
                    value={formData.title}
                    onChange={e => handleChange('title', e.target.value)}
                />

                <FormInput
                    label="Department"
                    value={formData.department}
                    onChange={e => handleChange('department', e.target.value)}
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

            {/* Roles Dropdown */}
            <div className="form-field" style={{ position: 'relative' }}>
                <label className="form-label">Assign Role</label>

                <input
                    type="text"
                    placeholder="Select a role..."
                    value={getDisplayValue()}
                    onChange={handleRoleInputChange}
                    onFocus={handleRoleInputFocus}
                    onBlur={handleRoleInputBlur}
                    style={{ width: '100%', padding: '0.5rem' }}
                    autoComplete="off"
                />

                {/* Dropdown list */}
                {dropdownOpen && (
                    <div
                        className="dropdown-options"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                            zIndex: 1000,
                        }}
                    >
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
                                            className={`dropdown-item ${isCurrent ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                                            style={{
                                                padding: '0.5rem',
                                                cursor: isCurrent ? 'not-allowed' : 'pointer',
                                                color: isCurrent ? '#999' : '#000',
                                                backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                                            }}
                                            onMouseDown={(e) => {
                                                // Use onMouseDown instead of onClick to fire before onBlur
                                                e.preventDefault();
                                                if (!isCurrent) {
                                                    handleRoleSelect(role.id);
                                                }
                                            }}
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