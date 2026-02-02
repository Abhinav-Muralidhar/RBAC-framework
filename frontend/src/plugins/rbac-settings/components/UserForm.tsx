/**
 * User Form Component
 * 
 * Create/Edit user form used in FormModal.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSelect, FormSwitch } from '../../../core/components/FormElements';
import type { User, CreateUserDto, UpdateUserDto } from '../../../core/types/user.types';
import type { Role } from '../../../core/types/role.types';
import { usersApi, rolesApi } from '../../../core/api/rbac.api';

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
        status: user?.status || 'ACTIVE',
        password: '',
    });

    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        user?.roles?.map(r => r.id) || []
    );
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            const response = await rolesApi.list({ limit: 100 });
            setAvailableRoles(response.data);
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
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        }
        if (!formData.primary_email.trim()) {
            newErrors.primary_email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primary_email)) {
            newErrors.primary_email = 'Invalid email format';
        }
        if (!formData.last_name.trim()) {
            newErrors.last_name = 'Last name is required';
        }
        if (!isEditing && !formData.password) {
            newErrors.password = 'Password is required for new users';
        } else if (!isEditing && formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

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
                    status: formData.status as 'active' | 'inactive',
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
                }
                await usersApi.create(createData);
            }
            onSuccess();
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    // Expose submit to parent via ref pattern or callback
    // For simplicity, we'll use a hidden button approach
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
                    placeholder="e.g., Software Engineer"
                />
                <FormInput
                    label="Department"
                    value={formData.department}
                    onChange={e => handleChange('department', e.target.value)}
                    placeholder="e.g., Engineering"
                />
            </div>

            <div className="form-row">
                <FormSelect
                    label="Status"
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value)}
                    options={[
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' },
                        { value: 'LOCKED', label: 'Locked' },
                    ]}
                />
                <FormInput
                    label={isEditing ? 'New Password (optional)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    error={errors.password}
                    required={!isEditing}
                    placeholder={isEditing ? 'Leave blank to keep current' : 'Min 8 characters'}
                />
            </div>

            {/* Roles selection */}
            <div className="form-field">
                <label className="form-label">Assign Roles</label>
                <div className="checkbox-group">
                    {availableRoles.map(role => (
                        <label key={role.id} className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={selectedRoles.includes(role.id)}
                                onChange={() => toggleRole(role.id)}
                            />
                            <span>{role.name}</span>
                        </label>
                    ))}
                    {availableRoles.length === 0 && (
                        <span className="text-muted">No roles available</span>
                    )}
                </div>
            </div>

            {/* Hidden submit button - form will be submitted by FormModal */}
            <button
                type="button"
                id="user-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

// Helper to trigger submit from outside
export function submitUserForm() {
    document.getElementById('user-form-submit')?.click();
}
