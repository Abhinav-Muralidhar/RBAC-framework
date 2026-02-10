/**
 * Group Form Component
 *
 * Create/Edit group form used in FormModal.
 * Uses centralized validators.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSwitch } from '../../../core/components/FormElements';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../../../core/types/group.types';
import type { Role } from '../../../core/types/role.types';
import type { User } from '../../../core/types/user.types';
import { usersApi, groupsApi, rolesApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode } from '../../../core/utils';

interface GroupFormProps {
    group?: Group | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function GroupForm({ group, onSuccess, onError, setLoading }: GroupFormProps) {
    const isEditing = !!group;

    const [formData, setFormData] = useState({
        name: group?.name || '',
        code: group?.code || '',
        description: group?.description || '',
        is_active: group?.is_active ?? true,
    });

    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        group?.roles?.map(r => r.id) || []
    );

    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [selectedUsers, setSelectedUsers] = useState<string[]>(
        group?.users?.map(u => u.id) || []
    );

    const [availableUsers, setAvailableUsers] = useState<User[]>([]);

    // ---------------- LOAD ROLES ----------------

    useEffect(() => {
        loadRoles();
    }, []);

    // Keep state in sync with props
    useEffect(() => {
        if (group) {
            setFormData({
                name: group.name || '',
                code: group.code || '',
                description: group.description || '',
                is_active: group.is_active ?? true,
            });
            setSelectedRoles(group.roles?.map(r => r.id) || []);
            setSelectedUsers(group.users?.map(u => u.id) || []);
        }
    }, [group]);

    const loadRoles = async () => {
        try {
            const response = await rolesApi.list({ limit: 100 });
            setAvailableRoles(response.data);
        } catch (err) {
            console.error('Failed to load roles', err);
        }
    };

    // ---------------- LOAD USERS ----------------

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await usersApi.list({ limit: 100 });
            setAvailableUsers(response.data);
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    // ---------------- HANDLERS ----------------

    const handleChange = (field: string, value: string | boolean) => {
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

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // ---------------- VALIDATION ----------------

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        const nameErr = validateRequired(formData.name.trim(), 'Name');
        if (nameErr) newErrors.name = nameErr;

        if (!isEditing) {
            const codeErr = validateCode(formData.code.trim());
            if (codeErr) newErrors.code = codeErr;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ---------------- SUBMIT ----------------

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);

        try {
            if (isEditing && group) {
                const updateData: UpdateGroupDto = {
                    name: formData.name.trim(),
                    description: formData.description || undefined,
                    role_ids: selectedRoles,
                    user_ids: selectedUsers,
                    is_active: formData.is_active,
                };

                await groupsApi.update(group.id, updateData);
            } else {
                const createData: CreateGroupDto = {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    description: formData.description || undefined,
                    role_ids: selectedRoles,
                    user_ids: selectedUsers,
                    is_active: formData.is_active,
                };

                await groupsApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save group');
        } finally {
            setLoading(false);
        }
    };

    // ---------------- UI ----------------

    return (
        <div className="entity-form">

            <FormInput
                label="Group Name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                error={errors.name}
                required
            />

            <FormInput
                label="Code"
                value={formData.code}
                onChange={e => handleChange('code', e.target.value.toUpperCase())}
                error={errors.code}
                disabled={isEditing}
                required
                hint="Uppercase letters and underscores only"
            />

            <div className="form-field">
                <label className="form-label">Description</label>
                <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={e => handleChange('description', e.target.value)}
                    rows={3}
                />
            </div>
            <FormSwitch
                label="Active"
                checked={formData.is_active}
                onChange={checked => handleChange('is_active', checked)}
            />

            {/* Roles selection */}
            <div className="form-field">
                <label className="form-label">Assign Roles to Group Members</label>

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

            <div className="form-field">
                <label className="form-label">Assign Users to Group Members</label>

                <div className="checkbox-group">
                    {availableUsers.map(user => (
                        <label key={user.id} className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={() => toggleUser(user.id)}
                            />
                            <span>{user.username}</span>
                        </label>
                    ))}

                    {availableUsers.length === 0 && (
                        <span className="text-muted">No users available</span>
                    )}
                </div>
            </div>

            <button
                type="button"
                id="group-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

// Trigger submit from modal
export function submitGroupForm() {
    document.getElementById('group-form-submit')?.click();
}
