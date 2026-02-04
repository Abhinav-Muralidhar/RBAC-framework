/**
 * Organization Page
 *
 * View & update organization details.
 * Uses centralized async hooks.
 */

import { useEffect, useState, useCallback } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { Organization } from '../../../core/types/organization.types';
import { Save, Building2, Globe, Phone, MapPin } from 'lucide-react';
import { FormInput } from '../../../core/components/FormElements';
import { useAsync, useAsyncCallback } from '../../../core/hooks';
import './SettingsPage.css';

export function OrganizationPage() {
    const [formData, setFormData] = useState<Partial<Organization>>({});
    const [success, setSuccess] = useState('');

    /* ---------------------------
       Load Organization
    ----------------------------*/
    const loadAsync = useAsync(async () => {
        return organizationApi.get();
    });

    /* ---------------------------
       Save Organization
    ----------------------------*/
    const saveAsync = useAsyncCallback(
        useCallback(async (data: Partial<Organization>, id: string) => {
            return organizationApi.update(id, data);
        }, [])
    );

    useEffect(() => {
        loadAsync.execute();
    }, []);

    useEffect(() => {
        if (loadAsync.data) {
            setFormData(loadAsync.data);
        }
    }, [loadAsync.data]);

    const handleChange = (field: keyof Organization, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSuccess('');
    };

    const handleSave = async () => {
        if (!loadAsync.data) return;

        setSuccess('');

        const result = await saveAsync.execute(formData, loadAsync.data.id);

        if (result) {
            setSuccess('Organization details updated successfully');
            loadAsync.execute(); // refresh data
        }
    };

    /* ---------------------------
       Render States
    ----------------------------*/
    if (loadAsync.isLoading) {
        return <div className="loading-state">Loading organization...</div>;
    }

    if (loadAsync.error) {
        return (
            <div className="error-message">
                {loadAsync.error}
            </div>
        );
    }

    if (!loadAsync.data) {
        return <div className="error-message">Organization not found</div>;
    }

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Organization</h1>
                    <p>Manage organization details and branding</p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saveAsync.isLoading}
                >
                    <Save size={18} />
                    {saveAsync.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
            </header>

            {loadAsync.error && (
                <div className="error-banner">
                    {loadAsync.error}
                </div>
            )}

            {saveAsync.error && (
                <div className="error-banner">
                    {saveAsync.error}
                </div>
            )}

            {success && (
                <div className="success-banner">
                    {success}
                </div>
            )}

            {/* ------------------ Basic Info ------------------ */}
            <div className="form-section">
                <h2>
                    <Building2 size={18} />
                    Basic Information
                </h2>

                <div className="form-grid">
                    <FormInput
                        label="Company Name"
                        value={formData.company_name || ''}
                        onChange={e => handleChange('company_name', e.target.value)}
                        required
                    />

                    <FormInput
                        label="Company Logo URL"
                        value={formData.company_logo || ''}
                        onChange={e => handleChange('company_logo', e.target.value)}
                        placeholder="https://..."
                    />

                    <FormInput
                        label="Website"
                        value={formData.website || ''}
                        onChange={e => handleChange('website', e.target.value)}
                        placeholder="https://..."
                    />
                </div>
            </div>

            {/* ------------------ Address ------------------ */}
            <div className="form-section">
                <h2>
                    <MapPin size={18} />
                    Address
                </h2>

                <div className="form-grid">
                    <FormInput label="Address" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                    <FormInput label="City" value={formData.city || ''} onChange={e => handleChange('city', e.target.value)} />
                    <FormInput label="State" value={formData.state || ''} onChange={e => handleChange('state', e.target.value)} />
                    <FormInput label="Postal Code" value={formData.postal_code || ''} onChange={e => handleChange('postal_code', e.target.value)} />
                    <FormInput label="Country" value={formData.country || ''} onChange={e => handleChange('country', e.target.value)} />
                    <FormInput label="Country Code" value={formData.country_code || ''} onChange={e => handleChange('country_code', e.target.value)} />
                </div>
            </div>

            {/* ------------------ Contact ------------------ */}
            <div className="form-section">
                <h2>
                    <Phone size={18} />
                    Contact
                </h2>

                <div className="form-grid">
                    <FormInput label="Phone" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                    <FormInput label="Fax" value={formData.fax || ''} onChange={e => handleChange('fax', e.target.value)} />
                </div>
            </div>

            {/* ------------------ Social & Business ------------------ */}
            <div className="form-section">
                <h2>
                    <Globe size={18} />
                    Social & Business
                </h2>

                <div className="form-grid">
                    <FormInput label="Facebook" value={formData.facebook || ''} onChange={e => handleChange('facebook', e.target.value)} />
                    <FormInput label="Twitter" value={formData.twitter || ''} onChange={e => handleChange('twitter', e.target.value)} />
                    <FormInput label="LinkedIn" value={formData.linkedin || ''} onChange={e => handleChange('linkedin', e.target.value)} />
                    <FormInput
                        label="Financial Year Start Month"
                        type="number"
                        min={1}
                        max={12}
                        value={formData.financial_year_start_month || ''}
                        onChange={e =>
                            handleChange(
                                'financial_year_start_month',
                                Number(e.target.value)
                            )
                        }
                    />
                </div>

            </div>
        </div>
    );
}
