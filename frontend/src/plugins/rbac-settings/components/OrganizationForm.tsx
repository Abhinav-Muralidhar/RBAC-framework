/**
 * Organization Form Component
 * 
 * Create/Edit organization form used in FormModal.
 * Handles validation and submission for create/update operations.
 */

import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FormInput, FormSelect } from '../../../core/components/FormElements';
import type { Organization } from '../../../core/types/organization.types';
import { organizationApi } from '../../../core/api/rbac.api';
import { validateRequired, validateDigitsLength, scrollToFirstError, parseApiError, validateExactLength, validateOptionalUrl, validatePhoneNumber } from '../../../core/utils';
import type { RbacFormHandle } from './form.types';
import './EntityForm.css';

interface OrganizationFormProps {
    organization?: Organization | null;
    onSuccess: (organization: Organization) => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export const OrganizationForm = forwardRef<RbacFormHandle, OrganizationFormProps>(function OrganizationForm({ organization, onSuccess, onError, setLoading }, ref) {
    const isEditing = !!organization;
    const queryClient = useQueryClient();

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
    const ASSET_BASE_URL = API_BASE_URL.replace(/\/v1\/?$/, '');
    const currentLogoUrl = organization?.company_logo
        ? `${ASSET_BASE_URL}/${organization.company_logo}`
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

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        const nameErr = validateRequired(formData.company_name.trim(), 'Company Name');
        if (nameErr) newErrors.company_name = nameErr;

        const addressErr = validateRequired(formData.address.trim(), 'Address');
        if (addressErr) newErrors.address = addressErr;

        const cityErr = validateRequired(formData.city.trim(), 'City');
        if (cityErr) newErrors.city = cityErr;

        const stateErr = validateRequired(formData.state.trim(), 'State');
        if (stateErr) newErrors.state = stateErr;

        const postalErr = validateRequired(formData.postal_code.trim(), 'Postal Code');
        if (postalErr) newErrors.postal_code = postalErr;

        const postalLenErr = validateDigitsLength(formData.postal_code.trim(), 6, 'Postal Code');
        if (postalLenErr) newErrors.postal_code = postalLenErr;

        const countryErr = validateRequired(formData.country.trim(), 'Country');
        if (countryErr) newErrors.country = countryErr;

        const countryCodeErr = validateRequired(formData.country_code.trim(), 'Country Code');
        if (countryCodeErr) newErrors.country_code = countryCodeErr;

        const gstinErr = validateRequired(formData.gstin.trim(), 'GSTIN');
        if (gstinErr) newErrors.gstin = gstinErr;

        const gstinLenErr = validateExactLength(formData.gstin.trim(), 15, 'GSTIN');
        if (gstinLenErr) newErrors.gstin = gstinLenErr;

        const phoneLenErr = validateDigitsLength(formData.phone, 10, 'Phone');
        if (phoneLenErr) newErrors.phone = phoneLenErr;

        const faxErr = validatePhoneNumber(formData.fax, 'Fax');
        if (faxErr) newErrors.fax = faxErr;

        const websiteErr = validateOptionalUrl(formData.website, 'Website');
        if (websiteErr) newErrors.website = websiteErr;

        const facebookErr = validateOptionalUrl(formData.facebook, 'Facebook');
        if (facebookErr) newErrors.facebook = facebookErr;

        const twitterErr = validateOptionalUrl(formData.twitter, 'Twitter');
        if (twitterErr) newErrors.twitter = twitterErr;

        const linkedinErr = validateOptionalUrl(formData.linkedin, 'LinkedIn');
        if (linkedinErr) newErrors.linkedin = linkedinErr;

        if (formData.financial_year_start_month) {
            const month = Number(formData.financial_year_start_month);
            if (!Number.isInteger(month) || month < 1 || month > 12) {
                newErrors.financial_year_start_month = 'Financial year start month must be between 1 and 12';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [
        formData.address,
        formData.city,
        formData.country,
        formData.country_code,
        formData.facebook,
        formData.fax,
        formData.financial_year_start_month,
        formData.gstin,
        formData.linkedin,
        formData.phone,
        formData.postal_code,
        formData.state,
        formData.twitter,
        formData.website,
        formData.company_name,
    ]);

    // ---------------- SUBMIT ----------------

    const handleSubmit = useCallback(async () => {
        if (!validate()) {
            scrollToFirstError();
            return;
        }

        setLoading(true);

        try {
            let result: Organization | undefined;

            if (isEditing && organization) {
                const payload = {
                    version: organization.version,
                    company_name: formData.company_name.trim(),
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
                    gstin: formData.gstin.trim(),
                    is_active: formData.is_active,
                };

                result = await organizationApi.update(organization.id, payload, logoFile || undefined);
                queryClient.invalidateQueries({ queryKey: ['branding'] });
            }

            if (result) {
                onSuccess(result);
            }
        } catch (err) {
            onError(parseApiError(err instanceof Error ? err.message : 'Failed to save organization'));
        } finally {
            setLoading(false);
        }
    }, [formData, isEditing, logoFile, onError, onSuccess, organization, queryClient, setLoading, validate]);

    useImperativeHandle(ref, () => ({
        submit: () => {
            void handleSubmit();
        },
    }), [handleSubmit]);

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
                    error={errors.address}
                    required
                />
                <FormInput
                    label="City"
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                    error={errors.city}
                    required
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="State"
                    value={formData.state}
                    onChange={e => handleChange('state', e.target.value)}
                    error={errors.state}
                    required
                />
                <FormInput
                    label="Postal Code"
                    value={formData.postal_code}
                    onChange={e => handleChange('postal_code', e.target.value)}
                    error={errors.postal_code}
                    required
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Country"
                    value={formData.country}
                    onChange={e => handleChange('country', e.target.value)}
                    error={errors.country}
                    required
                />
                <FormInput
                    label="Country Code"
                    value={formData.country_code}
                    onChange={e => handleChange('country_code', e.target.value)}
                    error={errors.country_code}
                    required
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Phone"
                    value={formData.phone || ''}
                    onChange={e => handleChange('phone', e.target.value)}
                    error={errors.phone}
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
                    error={errors.financial_year_start_month}
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

        </div>
    );
});
