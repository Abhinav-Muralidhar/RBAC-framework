/**
 * User Form Component
 * 
 * Create/Edit user form used in FormModal.
 * Uses centralized validators for password and email.
 */

import { forwardRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { FormInput, FormSwitch, FormSelect, FormSearchSelect } from '../../../core/components/FormElements';
import type { User, CreateUserDto, UpdateUserDto } from '../../../core/types/user.types';
import type { Role } from '../../../core/types/role.types';
import { usersApi, rolesApi, landingPagesApi, type LandingPageOption } from '../../../core/api/rbac.api';
import {
    NAME_FORMAT_OPTIONS,
    TIME_ZONE_OPTIONS,
    CURRENCY_OPTIONS,
    SYMBOL_PLACEMENT_OPTIONS,
    TRAILING_ZERO_OPTIONS,
    DIGIT_GROUPING_OPTIONS,
    DECIMAL_SEPARATOR_OPTIONS,
    DECIMAL_PRECISION_OPTIONS,
    PHONE_COUNTRY_CODE_OPTIONS,
} from '../../../core/constants/userPreferences';
import {
    validateEmail,
    validateOptionalEmail,
    validatePassword,
    validateRequired,
    validateUsername,
    validatePhoneNumber,
    validatePhoneCountryCode,
    validateInOptions,
    validateDecimalPrecision,
    scrollToFirstError,
    parseApiError
} from '../../../core/utils';
import type { RbacFormHandle } from './form.types';
import { useAsyncSearchOptions } from './useAsyncSearchOptions';
import './EntityForm.css';

interface UserFormProps {
    user?: User | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export const UserForm = forwardRef<RbacFormHandle, UserFormProps>(function UserForm({ user, onSuccess, onError, setLoading }, ref) {
    const isEditing = !!user;

    const [formData, setFormData] = useState({
        // Required
        username: user?.username || '',
        primary_email: user?.primary_email || '',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        password: '',
        status: (user?.status || 'active') as 'active' | 'inactive',

        // Personal
        title: user?.title || '',
        department: user?.department || '',

        // Contact
        secondary_email: user?.secondary_email || '',
        other_email: user?.other_email || '',
        office_phone: user?.office_phone || '',
        mobile_phone: user?.mobile_phone || '',
        home_phone: user?.home_phone || '',
        secondary_phone: user?.secondary_phone || '',
        fax: user?.fax || '',

        // Address
        street: user?.street || '',
        city: user?.city || '',
        state: user?.state || '',
        country: user?.country || '',
        postal_code: user?.postal_code || '',

        // Preferences
        default_landing_page: user?.default_landing_page || '',
        name_format: user?.name_format || '',
        phone_country_code: user?.phone_country_code || '',
        full_screen_preview: !!user?.full_screen_preview,
        time_zone: user?.time_zone || '',

        // Currency
        preferred_currency: user?.preferred_currency || '',
        digit_grouping_pattern: user?.digit_grouping_pattern || '',
        decimal_separator: user?.decimal_separator || '',
        decimal_precision: user?.decimal_precision?.toString() || '',
        symbol_placement: user?.symbol_placement || '',
        trailing_zero_handling: user?.trailing_zero_handling || '',

        // Other
        aggregation_format: user?.aggregation_format || '',
        signature: user?.signature || '',
    });

    // Role dropdown
    const [selectedRole, setSelectedRole] = useState<string>(user?.rolesid || '');
    // Reports-to user dropdown
    const [reportsToUserId, setReportsToUserId] = useState<string>(user?.reports_to_user_id || '');

    // Landing pages
    const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const phoneCountryCodes = PHONE_COUNTRY_CODE_OPTIONS.map(o => o.key) as string[];
    const currentPhoneCode = formData.phone_country_code;
    const phoneCountryOptions = currentPhoneCode && !phoneCountryCodes.includes(currentPhoneCode)
        ? [{ key: currentPhoneCode, label: `${currentPhoneCode} (Current)` }, ...PHONE_COUNTRY_CODE_OPTIONS]
        : PHONE_COUNTRY_CODE_OPTIONS;

    // =================== EFFECTS ===================

    // Load landing pages on mount
    useEffect(() => {
        landingPagesApi.list().then(setLandingPages).catch(() => { });
    }, []);

    // Initial loads
    const loadRoles = useCallback(async (searchQuery: string) => {
        const response = await rolesApi.list({
            limit: 100,
            search: searchQuery || undefined,
            is_active: true,
        });
        return response.data || [];
    }, []);

    const loadUsers = useCallback(async (searchQuery: string) => {
        const response = await usersApi.list({ limit: 100, search: searchQuery || undefined });
        return (response.data || []).filter(u => !user || u.id !== user.id);
    }, [user]);

    const {
        options: roleOptions,
        loading: roleSearchLoading,
        loadOptions: loadRoleOptions,
    } = useAsyncSearchOptions<Role, { value: string; label: string; disabled?: boolean }>({
        loader: loadRoles,
        mapOption: (roleOption) => ({
            value: roleOption.id,
            label: `${roleOption.name}${roleOption.id === user?.rolesid ? ' (Current)' : ''}`,
            disabled: roleOption.id === user?.rolesid,
        }),
    });

    const {
        options: reportsToOptions,
        loading: userSearchLoading,
        loadOptions: loadUserOptions,
    } = useAsyncSearchOptions<User, { value: string; label: string }>({
        loader: loadUsers,
        mapOption: (availableUser) => ({
            value: availableUser.id,
            label: `${availableUser.first_name || ''} ${availableUser.last_name || ''} (${availableUser.primary_email})`.trim(),
        }),
    });

    useEffect(() => { void loadRoleOptions(''); void loadUserOptions(''); }, [loadRoleOptions, loadUserOptions]);

    // Keep state in sync with props
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                primary_email: user.primary_email || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                password: '',
                status: (user.status || 'active') as 'active' | 'inactive',
                title: user.title || '',
                department: user.department || '',
                secondary_email: user.secondary_email || '',
                other_email: user.other_email || '',
                office_phone: user.office_phone || '',
                mobile_phone: user.mobile_phone || '',
                home_phone: user.home_phone || '',
                secondary_phone: user.secondary_phone || '',
                fax: user.fax || '',
                street: user.street || '',
                city: user.city || '',
                state: user.state || '',
                country: user.country || '',
                postal_code: user.postal_code || '',
                default_landing_page: user.default_landing_page || '',
                name_format: user.name_format || '',
                phone_country_code: user.phone_country_code || '',
                full_screen_preview: !!user.full_screen_preview,
                time_zone: user.time_zone || '',
                preferred_currency: user.preferred_currency || '',
                digit_grouping_pattern: user.digit_grouping_pattern || '',
                decimal_separator: user.decimal_separator || '',
                decimal_precision: user.decimal_precision?.toString() || '',
                symbol_placement: user.symbol_placement || '',
                trailing_zero_handling: user.trailing_zero_handling || '',
                aggregation_format: user.aggregation_format || '',
                signature: user.signature || '',
            });
            setSelectedRole(user.rolesid || '');
            setReportsToUserId(user.reports_to_user_id || '');
        }
    }, [user]);

    // =================== HANDLERS ===================

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    // =================== VALIDATION ===================

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (!isEditing) {
            const usernameErr = validateUsername(formData.username);
            if (usernameErr) newErrors.username = usernameErr;
        }

        const emailErr = validateEmail(formData.primary_email);
        if (emailErr) newErrors.primary_email = emailErr;

        const lastNameErr = validateRequired(formData.last_name, 'Last name');
        if (lastNameErr) newErrors.last_name = lastNameErr;

        const secondaryEmailErr = validateOptionalEmail(formData.secondary_email, 'Secondary email');
        if (secondaryEmailErr) newErrors.secondary_email = secondaryEmailErr;

        const otherEmailErr = validateOptionalEmail(formData.other_email, 'Other email');
        if (otherEmailErr) newErrors.other_email = otherEmailErr;

        const officePhoneErr = validatePhoneNumber(formData.office_phone, 'Office phone');
        if (officePhoneErr) newErrors.office_phone = officePhoneErr;

        const mobilePhoneErr = validatePhoneNumber(formData.mobile_phone, 'Mobile phone');
        if (mobilePhoneErr) newErrors.mobile_phone = mobilePhoneErr;

        const homePhoneErr = validatePhoneNumber(formData.home_phone, 'Home phone');
        if (homePhoneErr) newErrors.home_phone = homePhoneErr;

        const secondaryPhoneErr = validatePhoneNumber(formData.secondary_phone, 'Secondary phone');
        if (secondaryPhoneErr) newErrors.secondary_phone = secondaryPhoneErr;

        const faxErr = validatePhoneNumber(formData.fax, 'Fax');
        if (faxErr) newErrors.fax = faxErr;

        const phoneCountryErr = validatePhoneCountryCode(formData.phone_country_code);
        if (phoneCountryErr) newErrors.phone_country_code = phoneCountryErr;

        const nameFormatErr = validateInOptions(
            formData.name_format,
            NAME_FORMAT_OPTIONS.map(o => o.key),
            'Name format'
        );
        if (nameFormatErr) newErrors.name_format = nameFormatErr;

        if (formData.default_landing_page) {
            const landingKeys = landingPages.map(lp => lp.key);
            if (!landingKeys.includes(formData.default_landing_page)) {
                newErrors.default_landing_page = 'Default landing page is invalid';
            }
        }

        const timeZoneErr = validateInOptions(
            formData.time_zone,
            TIME_ZONE_OPTIONS.map(o => o.key),
            'Time zone'
        );
        if (timeZoneErr) newErrors.time_zone = timeZoneErr;

        const currencyErr = validateInOptions(
            formData.preferred_currency,
            CURRENCY_OPTIONS.map(o => o.key),
            'Preferred currency'
        );
        if (currencyErr) newErrors.preferred_currency = currencyErr;

        const groupingErr = validateInOptions(
            formData.digit_grouping_pattern,
            DIGIT_GROUPING_OPTIONS.map(o => o.key),
            'Digit grouping pattern'
        );
        if (groupingErr) newErrors.digit_grouping_pattern = groupingErr;

        const decimalSeparatorErr = validateInOptions(
            formData.decimal_separator,
            DECIMAL_SEPARATOR_OPTIONS.map(o => o.key),
            'Decimal separator'
        );
        if (decimalSeparatorErr) newErrors.decimal_separator = decimalSeparatorErr;

        const decimalPrecisionErr = validateDecimalPrecision(formData.decimal_precision);
        if (decimalPrecisionErr) newErrors.decimal_precision = decimalPrecisionErr;

        const symbolPlacementErr = validateInOptions(
            formData.symbol_placement,
            SYMBOL_PLACEMENT_OPTIONS.map(o => o.key),
            'Symbol placement'
        );
        if (symbolPlacementErr) newErrors.symbol_placement = symbolPlacementErr;

        const trailingZeroErr = validateInOptions(
            formData.trailing_zero_handling,
            TRAILING_ZERO_OPTIONS.map(o => o.key),
            'Trailing zero handling'
        );
        if (trailingZeroErr) newErrors.trailing_zero_handling = trailingZeroErr;

        if (!isEditing) {
            const passwordErr = validatePassword(formData.password);
            if (passwordErr) newErrors.password = passwordErr;
        } else if (formData.password) {
            const passwordErr = validatePassword(formData.password);
            if (passwordErr) newErrors.password = passwordErr;
        }

        if (!selectedRole) {
            newErrors.rolesid = 'Role is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, isEditing, landingPages, selectedRole]);

    // =================== SUBMIT ===================

    const handleSubmit = useCallback(async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            const commonFields = {
                primary_email: formData.primary_email,
                first_name: formData.first_name || undefined,
                last_name: formData.last_name,
                title: formData.title || undefined,
                department: formData.department || undefined,
                reports_to_user_id: reportsToUserId || undefined,
                secondary_email: formData.secondary_email || undefined,
                other_email: formData.other_email || undefined,
                office_phone: formData.office_phone || undefined,
                mobile_phone: formData.mobile_phone || undefined,
                home_phone: formData.home_phone || undefined,
                secondary_phone: formData.secondary_phone || undefined,
                fax: formData.fax || undefined,
                street: formData.street || undefined,
                city: formData.city || undefined,
                state: formData.state || undefined,
                country: formData.country || undefined,
                postal_code: formData.postal_code || undefined,
                default_landing_page: formData.default_landing_page || undefined,
                name_format: formData.name_format || undefined,
                phone_country_code: formData.phone_country_code || undefined,
                full_screen_preview: formData.full_screen_preview,
                time_zone: formData.time_zone || undefined,
                preferred_currency: formData.preferred_currency || undefined,
                digit_grouping_pattern: formData.digit_grouping_pattern || undefined,
                decimal_separator: formData.decimal_separator || undefined,
                decimal_precision: formData.decimal_precision === '' ? undefined : parseInt(formData.decimal_precision, 10),
                symbol_placement: (formData.symbol_placement as 'before' | 'after') || undefined,
                trailing_zero_handling: (formData.trailing_zero_handling as 'show' | 'hide') || undefined,
                aggregation_format: formData.aggregation_format || undefined,
                signature: formData.signature || undefined,
                rolesid: selectedRole,
            };

            if (isEditing && user) {
                const updateData: UpdateUserDto = {
                    version: user.version,
                    ...commonFields,
                    status: formData.status,
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                await usersApi.update(user.id, updateData);
            } else {
                const createData: CreateUserDto = {
                    ...commonFields,
                    username: formData.username,
                    password: formData.password,
                    rolesid: selectedRole,
                };
                await usersApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save user'));
        } finally {
            setLoading(false);
        }
    }, [formData, isEditing, onError, onSuccess, reportsToUserId, selectedRole, setLoading, user, validate]);

    useImperativeHandle(ref, () => ({
        submit: () => {
            void handleSubmit();
        },
    }), [handleSubmit]);

    // =================== RENDER ===================

    return (
        <div className="entity-form">

            {/* === Account Basics === */}
            <h3 className="form-section-title form-section-title--first">Account</h3>
            <div className="form-row">
                <FormInput
                    label="Username"
                    value={formData.username}
                    onChange={e => handleChange('username', e.target.value)}
                    error={errors.username}
                    disabled={isEditing}
                    required
                    hint={!isEditing ? "Letters, numbers, and underscores only" : undefined}
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
                <FormSwitch
                    label="Active"
                    checked={formData.status === 'active'}
                    onChange={checked => handleChange('status', checked ? 'active' : 'inactive')}
                    hint="Inactive users cannot log in but their data remains intact"
                />
                <FormInput
                    label={isEditing ? 'New Password (optional)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    error={errors.password}
                    required={!isEditing}
                />
            </div>

            {/* === Personal === */}
            <h3 className="form-section-title">Personal Information</h3>
            <div className="form-row">
                <FormInput label="First Name" value={formData.first_name} onChange={e => handleChange('first_name', e.target.value)} />
                <FormInput label="Last Name" value={formData.last_name} onChange={e => handleChange('last_name', e.target.value)} error={errors.last_name} required />
            </div>
            <div className="form-row">
                <FormInput label="Title" value={formData.title} onChange={e => handleChange('title', e.target.value)} />
                <FormInput label="Department" value={formData.department} onChange={e => handleChange('department', e.target.value)} />
            </div>

            {/* === Contact === */}
            <h3 className="form-section-title">Contact Details</h3>
            <div className="form-row">
                <FormInput
                    label="Secondary Email"
                    type="email"
                    value={formData.secondary_email}
                    onChange={e => handleChange('secondary_email', e.target.value)}
                    error={errors.secondary_email}
                />
                <FormInput
                    label="Other Email"
                    type="email"
                    value={formData.other_email}
                    onChange={e => handleChange('other_email', e.target.value)}
                    error={errors.other_email}
                />
            </div>
            <div className="form-row">
                <FormInput
                    label="Office Phone"
                    type="tel"
                    inputMode="tel"
                    value={formData.office_phone}
                    onChange={e => handleChange('office_phone', e.target.value)}
                    error={errors.office_phone}
                    hint="Digits only, include country code if needed"
                />
                <FormInput
                    label="Mobile Phone"
                    type="tel"
                    inputMode="tel"
                    value={formData.mobile_phone}
                    onChange={e => handleChange('mobile_phone', e.target.value)}
                    error={errors.mobile_phone}
                    hint="Digits only, include country code if needed"
                />
            </div>
            <div className="form-row">
                <FormInput
                    label="Home Phone"
                    type="tel"
                    inputMode="tel"
                    value={formData.home_phone}
                    onChange={e => handleChange('home_phone', e.target.value)}
                    error={errors.home_phone}
                    hint="Digits only, include country code if needed"
                />
                <FormInput
                    label="Secondary Phone"
                    type="tel"
                    inputMode="tel"
                    value={formData.secondary_phone}
                    onChange={e => handleChange('secondary_phone', e.target.value)}
                    error={errors.secondary_phone}
                    hint="Digits only, include country code if needed"
                />
            </div>
            <div className="form-row">
                <FormInput
                    label="Fax"
                    type="tel"
                    inputMode="tel"
                    value={formData.fax}
                    onChange={e => handleChange('fax', e.target.value)}
                    error={errors.fax}
                />
                <FormSelect
                    label="Phone Country Code"
                    value={formData.phone_country_code}
                    onChange={e => handleChange('phone_country_code', e.target.value)}
                    options={phoneCountryOptions.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.phone_country_code}
                />
            </div>

            {/* === Address === */}
            <h3 className="form-section-title">Address</h3>
            <FormInput label="Street" value={formData.street} onChange={e => handleChange('street', e.target.value)} />
            <div className="form-row">
                <FormInput label="City" value={formData.city} onChange={e => handleChange('city', e.target.value)} />
                <FormInput label="State" value={formData.state} onChange={e => handleChange('state', e.target.value)} />
            </div>
            <div className="form-row">
                <FormInput label="Country" value={formData.country} onChange={e => handleChange('country', e.target.value)} />
                <FormInput label="Postal Code" value={formData.postal_code} onChange={e => handleChange('postal_code', e.target.value)} />
            </div>

            {/* === Preferences === */}
            <h3 className="form-section-title">Preferences</h3>
            <div className="form-row">
                {/* Default Landing Page dropdown */}
                <FormSelect
                    label="Default Landing Page"
                    value={formData.default_landing_page}
                    onChange={e => handleChange('default_landing_page', e.target.value)}
                    options={landingPages.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="None (Dashboard)"
                    error={errors.default_landing_page}
                />

                {/* Name Format dropdown */}
                <FormSelect
                    label="Name Format"
                    value={formData.name_format}
                    onChange={e => handleChange('name_format', e.target.value)}
                    options={NAME_FORMAT_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.name_format}
                />
            </div>

            <div className="form-row">
                {/* Time Zone dropdown */}
                <FormSelect
                    label="Time Zone"
                    value={formData.time_zone}
                    onChange={e => handleChange('time_zone', e.target.value)}
                    options={TIME_ZONE_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.time_zone}
                />
                <FormSwitch
                    label="Full Screen Preview"
                    checked={formData.full_screen_preview}
                    onChange={checked => handleChange('full_screen_preview', checked)}
                    hint="Opens app in browser fullscreen (like F11)"
                />
            </div>

            {/* === Currency / Number Settings === */}
            <h3 className="form-section-title">Currency & Number Settings</h3>
            <div className="form-row">
                {/* Currency dropdown */}
                <FormSelect
                    label="Preferred Currency"
                    value={formData.preferred_currency}
                    onChange={e => handleChange('preferred_currency', e.target.value)}
                    options={CURRENCY_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.preferred_currency}
                />
                <FormSelect
                    label="Digit Grouping Pattern"
                    value={formData.digit_grouping_pattern}
                    onChange={e => handleChange('digit_grouping_pattern', e.target.value)}
                    options={DIGIT_GROUPING_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.digit_grouping_pattern}
                />
            </div>
            <div className="form-row">
                <FormSelect
                    label="Decimal Separator"
                    value={formData.decimal_separator}
                    onChange={e => handleChange('decimal_separator', e.target.value)}
                    options={DECIMAL_SEPARATOR_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.decimal_separator}
                />
                <FormSelect
                    label="Decimal Precision"
                    value={formData.decimal_precision}
                    onChange={e => handleChange('decimal_precision', e.target.value)}
                    options={DECIMAL_PRECISION_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.decimal_precision}
                />
            </div>
            <div className="form-row">
                {/* Symbol Placement dropdown */}
                <FormSelect
                    label="Symbol Placement"
                    value={formData.symbol_placement}
                    onChange={e => handleChange('symbol_placement', e.target.value)}
                    options={SYMBOL_PLACEMENT_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.symbol_placement}
                />

                <FormSelect
                    label="Trailing Zeros"
                    value={formData.trailing_zero_handling}
                    onChange={e => handleChange('trailing_zero_handling', e.target.value)}
                    options={TRAILING_ZERO_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    placeholder="Not Set"
                    error={errors.trailing_zero_handling}
                />
            </div>

            {/* === Other === */}
            <h3 className="form-section-title">Other</h3>
            <FormInput label="Aggregation Format" value={formData.aggregation_format} onChange={e => handleChange('aggregation_format', e.target.value)} />
            <FormInput label="Signature" type="textarea" value={formData.signature} onChange={e => handleChange('signature', e.target.value)} />

            {/* === Role Dropdown === */}
            <h3 className="form-section-title">Assignment</h3>

            <FormSearchSelect
                label="Assign Role"
                placeholder="Search and select a role..."
                value={selectedRole}
                options={roleOptions}
                onChange={setSelectedRole}
                    onSearch={loadRoleOptions}
                    loading={roleSearchLoading}
                error={errors.rolesid}
                required
                emptyMessage="No roles found"
            />

            {/* === Reports To Dropdown === */}
            <div className="form-field--spaced">
                <FormSearchSelect
                    label="Reports To"
                    placeholder="Search for a manager..."
                    value={reportsToUserId}
                    options={reportsToOptions}
                    onChange={setReportsToUserId}
                    onSearch={loadUserOptions}
                    loading={userSearchLoading}
                    allowClear
                    emptyMessage="No users found"
                />
            </div>
        </div>
    );
});
