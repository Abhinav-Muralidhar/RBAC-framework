/**
 * Role Form Component
 * 
 * Create/Edit role form used in FormModal.
 * Uses centralized validators.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSwitch } from '../../../core/components/FormElements';
import type { Role, CreateRoleDto, UpdateRoleDto } from '../../../core/types/role.types';
import type { Profile } from '../../../core/types/profile.types';
import { rolesApi, profilesApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode } from '../../../core/utils';

interface RoleFormProps {
    role?: Role | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function RoleForm({ role, onSuccess, onError, setLoading }: RoleFormProps) {
    const isEditing = !!role;

    const [formData, setFormData] = useState({
        name: role?.name || '',
        code: role?.code || '',
        description: role?.description || '',
        is_active: role?.is_active ?? true,
    });

    const [selectedProfiles, setSelectedProfiles] = useState<string[]>(
        role?.profiles?.map(p => p.id) || []
    );

    const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            const response = await profilesApi.list({ limit: 100 });
            setAvailableProfiles(response.data);
        } catch (err) {
            console.error('Failed to load profiles', err);
        }
    };

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const toggleProfile = (profileId: string) => {
        setSelectedProfiles(prev =>
            prev.includes(profileId)
                ? prev.filter(id => id !== profileId)
                : [...prev, profileId]
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
            if (isEditing && role) {
                const updateData: UpdateRoleDto = {
                    name: formData.name.trim(),
                    description: formData.description || undefined,
                    is_active: formData.is_active,
                    profile_ids: selectedProfiles,
                };

                await rolesApi.update(role.id, updateData);
            } else {
                const createData: CreateRoleDto = {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    description: formData.description || undefined,
                    profile_ids: selectedProfiles,
                };

                await rolesApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save role');
        } finally {
            setLoading(false);
        }
    };

    // ---------------- UI ----------------

    return (
        <div className="entity-form">

            <FormInput
                label="Role Name"
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

            {/* Profiles selection */}
            <div className="form-field">
                <label className="form-label">Assign Profiles</label>

                <div className="checkbox-group">
                    {availableProfiles.map(profile => (
                        <label key={profile.id} className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={selectedProfiles.includes(profile.id)}
                                onChange={() => toggleProfile(profile.id)}
                            />
                            <span>{profile.name}</span>
                        </label>
                    ))}

                    {availableProfiles.length === 0 && (
                        <span className="text-muted">No profiles available</span>
                    )}
                </div>
            </div>

            <button
                type="button"
                id="role-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

export function submitRoleForm() {
    document.getElementById('role-form-submit')?.click();
}
