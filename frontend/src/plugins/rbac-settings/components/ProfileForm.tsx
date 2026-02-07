import { useState, useEffect } from 'react';
import { FormInput, FormSwitch } from '../../../core/components/FormElements';
import type { Profile, CreateProfileDto, UpdateProfileDto, Permission } from '../../../core/types/profile.types';
import { profilesApi, permissionsApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode } from '../../../core/utils';

interface ProfileFormProps {
    profile?: Profile | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function ProfileForm({ profile, onSuccess, onError, setLoading }: ProfileFormProps) {
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

    // Define a mapping for module_id to module_name
    const moduleMapping: Record<string, string> = {
        "1": "Settings",
        "2": "Dashboard",
    };

    // Toggle selected permission
    const togglePermission = (id: string) => {
        setSelectedPermissionIds(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    // Group permissions by module_name (based on module_id)
    const groupedPermissions = permissions.reduce<Record<string, Permission[]>>(
        (acc, p) => {
            const moduleName = moduleMapping[p.module_id] || 'Unknown'; // Use module mapping to find module name
            acc[moduleName] ||= [];
            acc[moduleName].push(p);
            return acc;
        },
        {}
    );

    // Load all permissions on mount
    useEffect(() => {
        permissionsApi.list()
            .then(permissions => {
                setPermissions(permissions);
                setLoadingPermissions(false);  // Permissions are now loaded
            })
            .catch(() => {
                onError('Failed to load permissions');
                setLoadingPermissions(false);  // Even on error, stop loading
            });
    }, []);

    // Handle form field changes
    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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
            if (isEditing && profile) {
                const updateData: UpdateProfileDto = {
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
            onError(err instanceof Error ? err.message : 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

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
                {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module} className="permission-group">
                        <strong>{module}</strong>
                        {perms.map(p => (
                            <label key={p.id} className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={selectedPermissionIds.includes(p.id)}
                                    onChange={() => togglePermission(p.id)}
                                />
                                {p.action}
                            </label>
                        ))}
                    </div>
                ))}
            </div>

            <button
                type="button"
                id="profile-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

export function submitProfileForm() {
    document.getElementById('profile-form-submit')?.click();
}
