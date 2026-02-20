/**
 * Group Form Component
 *
 * Create/Edit group form used in FormModal.
 * Uses FormMultiSelect for searchable roles/users selection.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSwitch, FormMultiSelect } from '../../../core/components/FormElements';
import type { MultiSelectOption } from '../../../core/components/FormElements';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../../../core/types/group.types';
import { usersApi, groupsApi, rolesApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode, scrollToFirstError, parseApiError } from '../../../core/utils';

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

    const [selectedUsers, setSelectedUsers] = useState<string[]>(
        group?.users?.map(u => u.id) || []
    );

    const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([]);
    const [roleLoading, setRoleLoading] = useState(false);

    const [userOptions, setUserOptions] = useState<MultiSelectOption[]>([]);
    const [userLoading, setUserLoading] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // ---------------- LOAD DATA ----------------

    // Initial load
    useEffect(() => {
        loadRoles('');
        loadUsers('');
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

    const loadRoles = async (searchQuery: string) => {
        setRoleLoading(true);
        try {
            const response = await rolesApi.list({ limit: 100, search: searchQuery || undefined });
            setRoleOptions(
                (response.data || []).map(r => ({ value: r.id, label: r.name }))
            );
        } catch (err) {
            console.error('Failed to load roles', err);
        } finally {
            setRoleLoading(false);
        }
    };

    const loadUsers = async (searchQuery: string) => {
        setUserLoading(true);
        try {
            const response = await usersApi.list({ limit: 100, search: searchQuery || undefined });
            setUserOptions(
                (response.data || []).map(u => ({ value: u.id, label: u.username }))
            );
        } catch (err) {
            console.error('Failed to load users', err);
        } finally {
            setUserLoading(false);
        }
    };

    // ---------------- HANDLERS ----------------

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
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
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            if (isEditing && group) {
                const updateData: UpdateGroupDto = {
                    version: group.version,
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
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save group'));
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
            <FormMultiSelect
                label="Assign Roles to Group Members"
                placeholder="Search roles…"
                options={roleOptions}
                value={selectedRoles}
                onChange={setSelectedRoles}
                onSearch={loadRoles}
                loading={roleLoading}
                emptyMessage="No roles available"
            />

            {/* Users selection */}
            <FormMultiSelect
                label="Assign Users to Group Members"
                placeholder="Search users…"
                options={userOptions}
                value={selectedUsers}
                onChange={setSelectedUsers}
                onSearch={loadUsers}
                loading={userLoading}
                emptyMessage="No users available"
            />

            <button
                type="button"
                id="group-form-submit"
                className="visually-hidden"
                onClick={handleSubmit}
            />
        </div>
    );
}

// Trigger submit from modal
export function submitGroupForm() {
    document.getElementById('group-form-submit')?.click();
}
