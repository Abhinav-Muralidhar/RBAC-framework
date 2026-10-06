import { forwardRef, useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { FormInput, FormSwitch } from '../../../core/components/FormElements';
import type { Profile, CreateProfileDto, UpdateProfileDto, Permission } from '../../../core/types/profile.types';
import { profilesApi, permissionsApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode, scrollToFirstError, parseApiError } from '../../../core/utils';
import type { RbacFormHandle } from './form.types';
import './EntityForm.css';

interface ProfileFormProps {
    profile?: Profile | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

interface ModulePermissionGroup {
    moduleName: string;
    permissions: Permission[];
 }

export const ProfileForm = forwardRef<RbacFormHandle, ProfileFormProps>(function ProfileForm({ profile, onSuccess, onError, setLoading }, ref) {
    const isEditing = !!profile;

    const [formData, setFormData] = useState({
        name: profile?.name || '',
        code: profile?.code || '',
        description: profile?.description || '',
        is_active: profile?.is_active ?? true,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(profile?.permissions?.map(p => p.id) ?? []);
    const [loadingPermissions, setLoadingPermissions] = useState(true); // Loading state for permissions

    // Toggle selected permission
    const togglePermission = (id: string) => {
        setSelectedPermissionIds(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    // Group permissions by module_name
    const groupedPermissions = useMemo<ModulePermissionGroup[]>(() => {
        const groups: Record<string, Permission[]> = {};
        permissions.forEach((permission) => {
            const moduleName = permission.module_name || 'Unknown';
            if (!groups[moduleName]) {
                groups[moduleName] = [];
            }
            groups[moduleName].push(permission);
        });

        const actionOrder = ['create', 'read', 'update', 'delete', 'export'];
        Object.values(groups).forEach((group) => {
            group.sort((a, b) => {
                const idxA = actionOrder.indexOf(a.action);
                const idxB = actionOrder.indexOf(b.action);
                if (idxA === -1 || idxB === -1) {
                    return a.action.localeCompare(b.action);
                }
                return idxA - idxB;
            });
        });

        const moduleOrder = ['Settings', 'Dashboard', 'Users', 'Roles', 'Profiles', 'Groups', 'Organizations', 'Sessions', 'Audit Logs', 'SMTP'];
        const moduleEntries = Object.entries(groups).map(([moduleName, perms]) => ({
            moduleName,
            permissions: perms,
        }));

        return moduleEntries.sort((a, b) => {
            const indexA = moduleOrder.indexOf(a.moduleName);
            const indexB = moduleOrder.indexOf(b.moduleName);
            if (indexA === -1 && indexB === -1) {
                return a.moduleName.localeCompare(b.moduleName);
            }
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [permissions]);

    const formatPermissionLabel = (value: string) => {
        return value
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // Load all permissions on mount
    const loadPermissions = useCallback(() => {
        permissionsApi.list()
            .then(permissions => {
                setPermissions(permissions);
                setLoadingPermissions(false);
            })
            .catch(() => {
                onError('Failed to load permissions');
                setLoadingPermissions(false);
            });
    }, [onError]);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    // Keep state in sync with props
    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                code: profile.code || '',
                description: profile.description || '',
                is_active: profile.is_active ?? true,
            });
            setSelectedPermissionIds(profile.permissions?.map(p => p.id) ?? []);
        }
    }, [profile]);

    // Handle form field changes
    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    // ---------------- VALIDATION ----------------
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

    // ---------------- SUBMIT ----------------
    const handleSubmit = useCallback(async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            if (isEditing && profile) {
                const updateData: UpdateProfileDto = {
                    version: profile.version,
                    name: formData.name.trim(),
                    description: formData.description || undefined,
                    is_active: formData.is_active,
                    permission_ids: selectedPermissionIds,
                };
                await profilesApi.update(profile.id, updateData);
            } else {
                const createData: CreateProfileDto = {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    description: formData.description || undefined,
                    permission_ids: selectedPermissionIds,
                };
                await profilesApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save profile'));
        } finally {
            setLoading(false);
        }
    }, [formData.code, formData.description, formData.is_active, formData.name, isEditing, onError, onSuccess, profile, selectedPermissionIds, setLoading, validate]);

    useImperativeHandle(ref, () => ({
        submit: () => {
            void handleSubmit();
        },
    }), [handleSubmit]);

    // ---------------- UI ----------------
    if (loadingPermissions) {
        return <div>Loading Permissions...</div>; // Show loading message while permissions are being fetched
    }

    return (
        <div className="entity-form">
            <FormInput
                label="Profile Name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                error={errors.name}
                required
            />

            <FormInput
                label="Code"
                value={formData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('code', e.target.value.toUpperCase())}
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
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
                    rows={3}
                />
            </div>

            <FormSwitch
                label="Active"
                checked={formData.is_active}
                onChange={checked => handleChange('is_active', checked)}
                hint="Inactive profiles cannot be assigned"
            />

            <div className="form-field">
                <label className="form-label">Permissions</label>
                <div className="permission-section">
                    {groupedPermissions.map(({ moduleName, permissions: perms }) => {
                        const selectedCount = perms.filter(p => selectedPermissionIds.includes(p.id)).length;
                        return (
                            <div key={moduleName} className="permission-group">
                                <div className="permission-group-header">
                                    <span className="permission-group-title">{moduleName}</span>
                                    <span className="permission-group-count">
                                        {selectedCount}/{perms.length} selected
                                    </span>
                                </div>
                                <div className="permission-grid">
                                    {perms.map(p => {
                                        const isChecked = selectedPermissionIds.includes(p.id);
                                        return (
                                            <label key={p.id} className={`permission-item${isChecked ? ' is-checked' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => togglePermission(p.id)}
                                                />
                                                <span className="permission-label">{formatPermissionLabel(p.action)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
});
