/**
 * Organization Form Component
 * 
 * Create/Edit organization form used in FormModal.
 * Handles validation and submission for create/update operations.
 */

import { useState, useEffect, useRef } from 'react';
import { FormInput, FormSelect } from '../../../core/components/FormElements';
import type { OrganizationResponseDto } from '../../../core/types/organization.types';
import { organizationApi } from '../../../core/api/rbac.api';
import { validateRequired, scrollToFirstError, parseApiError } from '../../../core/utils';

interface OrganizationFormProps {
    organization?: OrganizationResponseDto | null;
    onSuccess: (organization: OrganizationResponseDto) => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function OrganizationForm({ organization, onSuccess, onError, setLoading }: OrganizationFormProps) {
    const isEditing = !!organization;

    const [formData, setFormData] = useState({
        company_name: organization?.company_name || '',
        address: organization?.address || '',
        city: organization?.city || '',
        state: organization?.state || '',
        postal_code: organization?.postal_code || '',
        country: organization?.country || '',
        country_code: organization?.country_code || '',
        phone: organization?.phone || '',
        fax: organization?.fax || '',
        website: organization?.website || '',
        facebook: organization?.facebook || '',
        twitter: organization?.twitter || '',
        linkedin: organization?.linkedin || '',
        financial_year_start_month: organization?.financial_year_start_month?.toString() || '',
        gstin: organization?.gstin || '',
        is_active: organization?.is_active ? true : false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const currentLogoUrl = organization?.company_logo
        ? `${API_BASE_URL}/${organization.company_logo}`
        : null;

    // Keep state in sync with props
    useEffect(() => {
        if (organization) {
            setFormData({
                company_name: organization.company_name || '',
                address: organization.address || '',
                city: organization.city || '',
                state: organization.state || '',
                postal_code: organization.postal_code || '',
                country: organization.country || '',
                country_code: organization.country_code || '',
                phone: organization.phone || '',
                fax: organization.fax || '',
                website: organization.website || '',
                facebook: organization.facebook || '',
                twitter: organization.twitter || '',
                linkedin: organization.linkedin || '',
                financial_year_start_month: organization.financial_year_start_month?.toString() || '',
                gstin: organization.gstin || '',
                is_active: organization.is_active ? true : false,
            });
        }
    }, [organization]);

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setLogoFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setLogoPreview(null);
        }
    };

    // ---------------- VALIDATION ----------------

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        const nameErr = validateRequired(formData.company_name, 'Company Name');
        if (nameErr) newErrors.company_name = nameErr;

        const gstinErr = validateRequired(formData.gstin, 'GSTIN');
        if (gstinErr) newErrors.gstin = gstinErr;

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
            const payload = {
                company_name: formData.company_name,
                address: formData.address || undefined,
                city: formData.city || undefined,
                state: formData.state || undefined,
                postal_code: formData.postal_code || undefined,
                country: formData.country || undefined,
                country_code: formData.country_code || undefined,
                phone: formData.phone || undefined,
                fax: formData.fax || undefined,
                website: formData.website || undefined,
                facebook: formData.facebook || undefined,
                twitter: formData.twitter || undefined,
                linkedin: formData.linkedin || undefined,
                financial_year_start_month: formData.financial_year_start_month
                    ? parseInt(formData.financial_year_start_month)
                    : undefined,
                gstin: formData.gstin,
                is_active: formData.is_active,
            };

            let result;

            if (isEditing && organization) {
                result = await organizationApi.update(organization.id, payload, logoFile || undefined);
            }

            onSuccess(result);
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save organization'));
        } finally {
            setLoading(false);
        }
    };

    // ---------------- UI ----------------

    return (
        <div className="entity-form">
            <div className="form-row">
                <FormInput
                    label="Company Name"
                    value={formData.company_name}
                    onChange={e => handleChange('company_name', e.target.value)}
                    error={errors.company_name}
                    required
                />
                <FormInput
                    label="GSTIN"
                    value={formData.gstin}
                    onChange={e => handleChange('gstin', e.target.value)}
                    error={errors.gstin}
                    required
                />
            </div>

            {/* Company Logo Upload */}
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Company Logo</label>
                    <div className="logo-upload-row">
                        {(logoPreview || currentLogoUrl) && (
                            <img
                                src={logoPreview || currentLogoUrl!}
                                alt="Logo preview"
                                className="logo-preview"
                            />
                        )}
                        <div className="logo-upload-actions">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={handleLogoChange}
                                className="visually-hidden"
                            />
                            <button
                                type="button"
                                className="btn btn-secondary btn-compact"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {currentLogoUrl || logoPreview ? 'Change Logo' : 'Upload Logo'}
                            </button>
                            {logoFile && (
                                <span className="logo-file-name">
                                    {logoFile.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="form-help-text">
                        PNG, JPG, WebP or SVG. Max 2MB.
                    </p>
                </div>
            </div>

            <div className="form-row">
                <FormInput
                    label="Address"
                    value={formData.address}
                    onChange={e => handleChange('address', e.target.value)}
                />
                <FormInput
                    label="City"
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="State"
                    value={formData.state}
                    onChange={e => handleChange('state', e.target.value)}
                />
                <FormInput
                    label="Postal Code"
                    value={formData.postal_code}
                    onChange={e => handleChange('postal_code', e.target.value)}
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Country"
                    value={formData.country}
                    onChange={e => handleChange('country', e.target.value)}
                />
                <FormInput
                    label="Country Code"
                    value={formData.country_code}
                    onChange={e => handleChange('country_code', e.target.value)}
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Phone"
                    value={formData.phone || ''}
                    onChange={e => handleChange('phone', e.target.value)}
                />
                <FormInput
                    label="Fax"
                    value={formData.fax || ''}
                    onChange={e => handleChange('fax', e.target.value)}
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Website"
                    value={formData.website || ''}
                    onChange={e => handleChange('website', e.target.value)}
                    error={errors.website}
                />
                <FormInput
                    label="Facebook"
                    value={formData.facebook || ''}
                    onChange={e => handleChange('facebook', e.target.value)}
                    error={errors.facebook}
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Twitter"
                    value={formData.twitter || ''}
                    onChange={e => handleChange('twitter', e.target.value)}
                    error={errors.twitter}
                />
                <FormInput
                    label="LinkedIn"
                    value={formData.linkedin || ''}
                    onChange={e => handleChange('linkedin', e.target.value)}
                    error={errors.linkedin}
                />
            </div>

            <div className="form-row">
                <FormSelect
                    label="Financial Year Start Month"
                    value={formData.financial_year_start_month}
                    onChange={e => handleChange('financial_year_start_month', e.target.value)}
                    options={[
                        { value: '', label: 'Select Month' },
                        { value: '1', label: 'January' },
                        { value: '2', label: 'February' },
                        { value: '3', label: 'March' },
                        { value: '4', label: 'April' },
                        { value: '5', label: 'May' },
                        { value: '6', label: 'June' },
                        { value: '7', label: 'July' },
                        { value: '8', label: 'August' },
                        { value: '9', label: 'September' },
                        { value: '10', label: 'October' },
                        { value: '11', label: 'November' },
                        { value: '12', label: 'December' },
                    ]}
                />

                {/*<FormSelect
                    label="Status"
                    value={formData.is_active ? 'active' : 'inactive'} // map boolean -> string
                    onChange={e => handleChange('is_active', e.target.value === 'active')} // map string -> boolean
                    options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                    ]}
                />*/}
            </div>

            {/* Hidden submit button */}
            <button
                type="button"
                id="organization-form-submit"
                className="visually-hidden"
                onClick={handleSubmit}
            />
        </div>
    );
}

/** Trigger submit from FormModal */
export function submitOrganizationForm() {
    document.getElementById('organization-form-submit')?.click();
}
