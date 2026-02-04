/**
 * Organization Page
 *
 * Singleton settings page with Profiles-style UI/UX.
 */

import { useEffect, useState, useCallback } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { Organization } from '../../../core/types/organization.types';
import { Edit2, Building2 } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { OrganizationForm, submitOrganizationForm } from '../components/OrganizationForm';
import './SettingsPage.css';

export function OrganizationPage() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadOrganization();
    }, []);

    const loadOrganization = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await organizationApi.get();
            setOrganization(data);
        } catch {
            setError('Failed to load organization details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSuccess = (updated?: Organization) => {
        // Update local state instead of refetching
        if (updated) {
            setOrganization(updated);
        }
        setShowForm(false);
    };

    const [showForm, setShowForm] = useState(false);

    return (
        <div className="settings-page">
            {/* Header — identical structure to Profiles */}
            <header className="page-header">
                <div>
                    <h1>Organization</h1>
                    <p>Manage organization details and branding</p>
                </div>
                {organization && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowForm(true)}
                    >
                        <Edit2 size={18} />
                        Edit Organization
                    </button>
                )}
            </header>

            {/* Error banner */}
            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div className="loading-state">Loading organization...</div>
            ) : !organization ? (
                <div className="empty-state">
                    <Building2 size={32} />
                    <p>No organization data found</p>
                </div>
            ) : (
                /**
                 * Summary content instead of table
                 * Visually replaces Profiles data-table
                 */
                <div className="data-table-wrapper">
                    <div className="details-card">
                        <div className="details-grid">
                            <div>
                                <label>Company Name</label>
                                <span>{organization.company_name}</span>
                            </div>
                            <div>
                                <label>Website</label>
                                <span>{organization.website || '-'}</span>
                            </div>
                            <div>
                                <label>Phone</label>
                                <span>{organization.phone || '-'}</span>
                            </div>
                            <div>
                                <label>Country</label>
                                <span>{organization.country || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal — identical pattern to Profiles */}
            <FormModal
                isOpen={showForm}
                title="Edit Organization"
                onSubmit={() => submitOrganizationForm()}
                onCancel={() => setShowForm(false)}
                size="lg"
            >
                <OrganizationForm
                    organization={organization}
                    onSuccess={(updated) => handleFormSuccess(updated)}
                    onError={setError}
                    setLoading={setIsLoading}
                />
            </FormModal>
        </div>
    );
}
