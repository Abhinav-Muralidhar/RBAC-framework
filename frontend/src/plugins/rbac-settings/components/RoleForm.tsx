import { forwardRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { FormInput, FormSwitch, FormMultiSelect, FormSearchSelect } from '../../../core/components/FormElements';
import type { MultiSelectOption, SearchSelectOption } from '../../../core/components/FormElements';
import type { Role, CreateRoleDto, UpdateRoleDto } from '../../../core/types/role.types';
import { rolesApi, profilesApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode, scrollToFirstError, parseApiError } from '../../../core/utils';
import type { RbacFormHandle } from './form.types';
import { useAsyncSearchOptions } from './useAsyncSearchOptions';
import './EntityForm.css';

interface RoleFormProps {
    role?: Role | null;
    initialParentId?: string | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export const RoleForm = forwardRef<RbacFormHandle, RoleFormProps>(function RoleForm({ role, initialParentId, onSuccess, onError, setLoading }, ref) {
    const isEditing = !!role;
    const [formData, setFormData] = useState({
        name: role?.name || '',
        code: role?.code || '',
        description: role?.description || '',
        is_active: role?.is_active ?? true,
    });

    const [selectedProfiles, setSelectedProfiles] = useState<string[]>(
        role?.profiles?.map(profile => profile.id) || []
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedParentRole, setSelectedParentRole] = useState<string>(
        role?.parent_role_id || initialParentId || ''
    );
    useEffect(() => {
        if (role) {
            setFormData({
                name: role.name || '',
                code: role.code || '',
                description: role.description || '',
                is_active: role.is_active ?? true,
            });
            setSelectedProfiles(role.profiles?.map(profile => profile.id) || []);
        }
    }, [role]);

    useEffect(() => {
        if (role) {
            setSelectedParentRole(role.parent_role_id || '');
        } else {
            setSelectedParentRole(initialParentId || '');
        }
    }, [role, initialParentId]);

    const loadProfiles = useCallback(async (searchQuery: string) => {
        const { data = [] } = await profilesApi.list({
            limit: 100,
            search: searchQuery || undefined,
            is_active: true,
        });
        return data;
    }, []);

    const loadRoles = useCallback(async (searchQuery: string) => {
        const { data = [] } = await rolesApi.list({
            limit: 100,
            search: searchQuery || undefined,
            is_active: true,
        });
        return data.filter((availableRole) => availableRole.id !== role?.id);
    }, [role?.id]);

    const {
        options: profileOptions,
        loading: profileLoading,
        loadOptions: loadProfileOptions,
    } = useAsyncSearchOptions<{ id: string; name: string }, MultiSelectOption>({
        loader: loadProfiles,
        mapOption: (profile) => ({ value: profile.id, label: profile.name }),
    });

    const {
        options: parentRoleOptions,
        loading: roleSearchLoading,
        loadOptions: loadRoleOptions,
    } = useAsyncSearchOptions<Role, SearchSelectOption>({
        loader: loadRoles,
        mapOption: (parentRole) => ({
            value: parentRole.id,
            label: parentRole.name,
        }),
    });

    useEffect(() => {
        void loadProfileOptions('');
        void loadRoleOptions('');
    }, [loadProfileOptions, loadRoleOptions]);

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        const nameErr = validateRequired(formData.name.trim(), 'Name');
        if (nameErr) newErrors.name = nameErr;

        if (!isEditing) {
            const codeErr = validateCode(formData.code.trim());
            if (codeErr) newErrors.code = codeErr;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData.code, formData.name, isEditing]);

    const handleSubmit = useCallback(async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            const finalParentRoleId = selectedParentRole === '' ? null : selectedParentRole;

            if (isEditing && role) {
                const updateData: UpdateRoleDto = {
                    version: role.version,
                    name: formData.name.trim(),
                    description: formData.description || undefined,
                    is_active: formData.is_active,
                    profile_ids: selectedProfiles,
                    parent_role_id: finalParentRoleId,
                };

                await rolesApi.update(role.id, updateData);
            } else {
                const createData: CreateRoleDto = {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    description: formData.description || undefined,
                    profile_ids: selectedProfiles,
                    parent_role_id: finalParentRoleId || undefined,
                };

                await rolesApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save role'));
        } finally {
            setLoading(false);
        }
    }, [formData.code, formData.description, formData.is_active, formData.name, isEditing, onError, onSuccess, role, selectedParentRole, selectedProfiles, setLoading, validate]);

    useImperativeHandle(ref, () => ({
        submit: () => {
            void handleSubmit();
        },
    }), [handleSubmit]);

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

            <FormSearchSelect
                label="Parent Role"
                placeholder="Select a parent role... (Optional)"
                value={selectedParentRole}
                options={parentRoleOptions}
                onChange={setSelectedParentRole}
                onSearch={loadRoleOptions}
                loading={roleSearchLoading}
                allowClear
                emptyMessage="No roles found"
            />

            <FormMultiSelect
                label="Assign Profiles"
                placeholder="Search profiles..."
                options={profileOptions}
                value={selectedProfiles}
                onChange={setSelectedProfiles}
                onSearch={loadProfileOptions}
                loading={profileLoading}
                emptyMessage="No profiles available"
            />
        </div>
    );
});
