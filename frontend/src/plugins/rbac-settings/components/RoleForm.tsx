import { useState, useEffect, useRef } from 'react';
import { FormInput, FormSwitch, FormMultiSelect } from '../../../core/components/FormElements';
import type { MultiSelectOption } from '../../../core/components/FormElements';
import type { Role, CreateRoleDto, UpdateRoleDto } from '../../../core/types/role.types';
import { rolesApi, profilesApi } from '../../../core/api/rbac.api';
import { validateRequired, validateCode, scrollToFirstError, parseApiError } from '../../../core/utils';

interface RoleFormProps {
    role?: Role | null;
    initialParentId?: string | null; // Allow null here for strict typing
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function RoleForm({ role, initialParentId, onSuccess, onError, setLoading }: RoleFormProps) {
    const isEditing = !!role;
    // Add this inside RoleForm
    const [roleSearchTimer, setRoleSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [formData, setFormData] = useState({
        name: role?.name || '',
        code: role?.code || '',
        description: role?.description || '',
        is_active: role?.is_active ?? true,
    });

    const [selectedProfiles, setSelectedProfiles] = useState<string[]>(
        role?.profiles?.map(p => p.id) || []
    );

    const [profileOptions, setProfileOptions] = useState<MultiSelectOption[]>([]);
    const [profileLoading, setProfileLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // 1. Initialize with initialParentId if available and not editing
    const [selectedParentRole, setSelectedParentRole] = useState<string>(
        role?.parent_role_id || initialParentId || ''
    );

    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [roleSearch, setRoleSearch] = useState('');
    const [roleSearchLoading, setRoleSearchLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        loadProfiles('');
        loadRoles(''); // Load roles immediately so we can resolve the initialParentId name
    }, []);

    // Keep form data in sync if 'role' prop changes (Edit mode)
    useEffect(() => {
        if (role) {
            setFormData({
                name: role.name || '',
                code: role.code || '',
                description: role.description || '',
                is_active: role.is_active ?? true,
            });
            setSelectedProfiles(role.profiles?.map(p => p.id) || []);
        }
    }, [role]);

    // 2. IMPORTANT: Keep Parent Role ID in sync with props
    // This handles switching between "Edit Role A", "Add Child to B", and "Add Root Role"
    useEffect(() => {
        if (role) {
            setSelectedParentRole(role.parent_role_id || '');
        } else {
            // In create mode, use the passed parent ID (from tree click) or reset
            setSelectedParentRole(initialParentId || '');
        }
    }, [role, initialParentId]);


    const loadProfiles = async (searchQuery: string) => {
        setProfileLoading(true);
        try {
            const response = await profilesApi.list({ limit: 100, search: searchQuery || undefined });
            setProfileOptions(
                (response.data || []).map(p => ({ value: p.id, label: p.name }))
            );
        } catch (err) {
            console.error('Failed to load profiles', err);
        } finally {
            setProfileLoading(false);
        }
    };

    const loadRoles = async (searchQuery: string) => {
        setRoleSearchLoading(true);
        try {
            const response = await rolesApi.list({
                limit: 100,
                search: searchQuery || undefined,
            });

            // prevent self-parenting
            setAvailableRoles(
                (response.data || []).filter(r => r.id !== role?.id)
            );
        } catch (err) {
            console.error('Failed to load roles', err);
        } finally {
            setRoleSearchLoading(false);
        }
    };

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };



    const getParentRoleDisplayValue = () => {
        if (isSearching) return roleSearch;

        // Find the role in the loaded list
        if (selectedParentRole) {
            const parent = availableRoles.find(r => r.id === selectedParentRole);
            return parent?.name || '';
        }
        return '';
    };

    const handleParentRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setRoleSearch(value);
        setIsSearching(true);

        if (!value) {
            setSelectedParentRole('');
        }
    };

    const handleParentRoleSelect = (roleId: string) => {
        setSelectedParentRole(roleId);
        setRoleSearch('');
        setIsSearching(false);
        setDropdownOpen(false);
    };

    const handleParentRoleInputFocus = () => {
        setDropdownOpen(true);
    };

    const handleParentRoleInputBlur = () => {
        setTimeout(() => {
            setDropdownOpen(false);
            setIsSearching(false);
            setRoleSearch('');
        }, 200);
    };

    useEffect(() => {
        // Clear any existing timer
        if (roleSearchTimer) clearTimeout(roleSearchTimer);

        // Only search if the user is actively searching (typing)
        if (isSearching) {
            const timer = setTimeout(() => {
                loadRoles(roleSearch);
            }, 300); // 300ms delay to wait for user to stop typing

            setRoleSearchTimer(timer);

            return () => {
                if (timer) clearTimeout(timer);
            };
        }
    }, [roleSearch, isSearching]);

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
            const finalParentRoleId = selectedParentRole === '' ? null : selectedParentRole;
            if (isEditing && role) {
                const updateData: UpdateRoleDto = {
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
                    parent_role_id: finalParentRoleId || null,
                };

                await rolesApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save role'));
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

            {/* Parent Role Dropdown */}
            <div className="form-field" style={{ position: 'relative' }}>
                <label className="form-label">Parent Role</label>

                <input
                    type="text"
                    placeholder="Select a parent role... (Optional)"
                    value={getParentRoleDisplayValue()}
                    onChange={handleParentRoleInputChange}
                    onFocus={handleParentRoleInputFocus}
                    onBlur={handleParentRoleInputBlur}
                    className="form-input"
                    autoComplete="off"
                />

                {dropdownOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                            zIndex: 1000,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        {roleSearchLoading ? (
                            <div style={{ padding: '0.5rem', color: '#999' }}>
                                Loading...
                            </div>
                        ) : (
                            <>
                                {availableRoles.map(r => {
                                    const isSelected = r.id === selectedParentRole;
                                    return (
                                        <div
                                            key={r.id}
                                            style={{
                                                padding: '0.5rem',
                                                cursor: 'pointer',
                                                backgroundColor: isSelected
                                                    ? '#e3f2fd'
                                                    : 'transparent',
                                            }}
                                            onMouseDown={e => {
                                                e.preventDefault();
                                                handleParentRoleSelect(r.id);
                                            }}
                                            className="hover:bg-gray-50" // Optional Tailwind utility if you have it
                                        >
                                            {r.name} {isSelected && '✓'}
                                        </div>
                                    );
                                })}

                                {availableRoles.length === 0 && (
                                    <div style={{ padding: '0.5rem', color: '#999' }}>
                                        No roles found
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>


            {/* Profiles selection */}
            <FormMultiSelect
                label="Assign Profiles"
                placeholder="Search profiles…"
                options={profileOptions}
                value={selectedProfiles}
                onChange={setSelectedProfiles}
                onSearch={loadProfiles}
                loading={profileLoading}
                emptyMessage="No profiles available"
            />

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
