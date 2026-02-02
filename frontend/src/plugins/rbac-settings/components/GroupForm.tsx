/**
 * Group Form Component
 * 
 * Create/Edit group form used in FormModal.
 */

import { useState, useEffect } from 'react';
import { FormInput, FormSelect } from '../../../core/components/FormElements';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../../../core/types/group.types';
import type { Role } from '../../../core/types/role.types';
import { groupsApi, rolesApi } from '../../../core/api/rbac.api';

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
        description: group?.description || '',
        code: group?.code || '',
    });

    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        group?.roles?.map(r => r.id) || []
    );
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [rolesResponse, groupsResponse] = await Promise.all([
                rolesApi.list({ limit: 100 }),
                groupsApi.list({ limit: 100 }),
            ]);
            setAvailableRoles(rolesResponse.data);
            // Filter out current group to prevent self-reference
            setAvailableGroups(
                groupsResponse.data.filter(g => g.id !== group?.id)
            );
        } catch (err) {
            console.error('Failed to load data', err);
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

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            if (isEditing && group) {
                const updateData: UpdateGroupDto = {
                    name: formData.name,
                    description: formData.description || undefined,
                };
                await groupsApi.update(group.id, updateData);
            } else {
                const createData: CreateGroupDto = {
                    name: formData.name,
                    description: formData.description || undefined,
                    code: formData.code || undefined,
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

    return (
        <div className="entity-form">
            <FormInput
                label="Group Name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                error={errors.name}
                required
                placeholder="e.g., Engineering Team"
            />

            <div className="form-field">
                <label className="form-label">Description</label>
                <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={e => handleChange('description', e.target.value)}
                    placeholder="Describe this group's purpose..."
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

export function submitGroupForm() {
    document.getElementById('group-form-submit')?.click();
}
