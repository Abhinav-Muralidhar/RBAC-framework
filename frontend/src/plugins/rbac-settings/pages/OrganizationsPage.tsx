/**
 * Organization Page
 *
 * View & update organization details.
 * No create / delete for now.
 */

import { useEffect, useState } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { Organization } from '../../../core/types/organization.types';
import { Save, Building2, Globe, Phone, MapPin } from 'lucide-react';
import { FormInput } from '../../../core/components/FormElements';
import './SettingsPage.css';

export function OrganizationPage() {
    const [org, setOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState<Partial<Organization>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadOrganization();
    }, []);

    const loadOrganization = async () => {
        try {
            setIsLoading(true);
            const response = await organizationApi.get(); // single org
            setOrg(response);
            setFormData(response);
        } catch (err) {
            setError('Failed to load organization details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (field: keyof Organization, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    const handleSave = async () => {
        if (!org) return;

        try {
            setIsSaving(true);
            await organizationApi.update(org.id, formData);
            setSuccess('Organization details updated successfully');
            loadOrganization();
        } catch (err) {
            setError('Failed to update organization');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="loading-state">Loading organization...</div>;
    }

    if (!org) {
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
                    disabled={isSaving}
                >
                    <Save size={18} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {success && <div className="success-banner">{success}</div>}

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

            <div className="form-section">
                <h2>
                    <MapPin size={18} />
                    Address
                </h2>

                <div className="form-grid">
                    <FormInput
                        label="Address"
                        value={formData.address || ''}
                        onChange={e => handleChange('address', e.target.value)}
                    />
                    <FormInput
                        label="City"
                        value={formData.city || ''}
                        onChange={e => handleChange('city', e.target.value)}
                    />
                    <FormInput
                        label="State"
                        value={formData.state || ''}
                        onChange={e => handleChange('state', e.target.value)}
                    />
                    <FormInput
                        label="Postal Code"
                        value={formData.postal_code || ''}
                        onChange={e => handleChange('postal_code', e.target.value)}
                    />
                    <FormInput
                        label="Country"
                        value={formData.country || ''}
                        onChange={e => handleChange('country', e.target.value)}
                    />
                    <FormInput
                        label="Country Code"
                        value={formData.country_code || ''}
                        onChange={e => handleChange('country_code', e.target.value)}
                    />
                </div>
            </div>

            <div className="form-section">
                <h2>
                    <Phone size={18} />
                    Contact
                </h2>

                <div className="form-grid">
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
            </div>

            <div className="form-section">
                <h2>
                    <Globe size={18} />
                    Social & Business
                </h2>

                <div className="form-grid">
                    <FormInput
                        label="Facebook"
                        value={formData.facebook || ''}
                        onChange={e => handleChange('facebook', e.target.value)}
                    />
                    <FormInput
                        label="Twitter"
                        value={formData.twitter || ''}
                        onChange={e => handleChange('twitter', e.target.value)}
                    />
                    <FormInput
                        label="LinkedIn"
                        value={formData.linkedin || ''}
                        onChange={e => handleChange('linkedin', e.target.value)}
                    />
                    <FormInput
                        label="Financial Year Start Month"
                        type="number"
                        min={1}
                        max={12}
                        value={formData.financial_year_start_month || ''}
                        onChange={e =>
                            handleChange('financial_year_start_month', Number(e.target.value))
                        }
                    />
                </div>
            </div>
        </div>
    );
}
