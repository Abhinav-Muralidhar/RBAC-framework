/**
 * User Form Component
 * 
 * Create/Edit user form used in FormModal.
 * Uses centralized validators for password and email.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSelect } from '../../../core/components/FormElements';
import type { User, CreateUserDto, UpdateUserDto } from '../../../core/types/user.types';
import type { Role } from '../../../core/types/role.types';
import { usersApi, rolesApi } from '../../../core/api/rbac.api';
import {
    validateEmail,
    validatePassword,
    validateRequired,
    validateUsername
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

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            const response = await rolesApi.list({ limit: 100 });
            setAvailableRoles(response.data || []);
        } catch (err) {
            console.error('Failed to load roles', err);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const toggleRole = (roleId: string) => {
        setSelectedRole(prev => (prev === roleId ? null : roleId));
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
        if (!validate()) return;

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
            onError(err instanceof Error ? err.message : 'Failed to save user');
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
                <FormSelect
                    label="Status"
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value)}
                    options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                    ]}
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

            {/* Roles */}
            <div className="form-field">
                <label className="form-label">Assign Roles</label>

                {/* Search input */}
                <input
                    type="text"
                    placeholder="Search roles..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '0.25rem' }}
                />

                {/* Native select dropdown */}
                <select className='form-select'
                    value={selectedRole || ''}
                    onChange={e => setSelectedRole(e.target.value)}
                    size={Math.min(5, availableRoles.length)} // shows a few options, scrollable
                >
                    <option value="" disabled >
                        Select a role
                    </option>

                    {availableRoles
                        .filter(role =>
                            role.name.toLowerCase().includes(roleSearch.toLowerCase())
                        )
                        .map(role => (
                            <option
                                key={role.id}
                                value={role.id}
                                disabled={role.id === user?.rolesid}
                            >
                                {role.name}
                            </option>
                        ))}
                </select>

                {availableRoles.length === 0 && (
                    <span className="text-muted">No roles available</span>
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
