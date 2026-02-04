/**
 * Group Form Component
 *
 * Create/Edit group form used in FormModal.
 * Uses centralized validators.
 */

import { useState, useEffect } from 'react';
import { FormInput } from '../../../core/components/FormElements';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../../../core/types/group.types';
import type { Role } from '../../../core/types/role.types';
import { groupsApi, rolesApi } from '../../../core/api/rbac.api';
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
    });

    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        group?.roles?.map(r => r.id) || []
    );

    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ---------------- LOAD ROLES ----------------

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

    // ---------------- HANDLERS ----------------

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
                    role_ids: selectedRoles, // ✅ FIX
                };

                await groupsApi.update(group.id, updateData);
            } else {
                const createData: CreateGroupDto = {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    description: formData.description || undefined,
                    role_ids: selectedRoles, // ✅ FIX
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
