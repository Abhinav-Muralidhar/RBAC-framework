import { useEffect, useState } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { Organization } from '../../../core/types/organization.types';
import { Edit2 } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { OrganizationForm, submitOrganizationForm } from '../components/OrganizationForm';
import './SettingsPage.css';

export function OrganizationPage() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        loadOrganization();
    }, []);

    const loadOrganization = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const res = await organizationApi.get();
            console.log('Organization API:', res);
            setOrganization(res[0]);

        } catch (err: any) {
            setError(err.message || 'Failed to load organization details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSuccess = (updated?: Organization) => {
        if (updated) setOrganization(updated);
        setShowForm(false);
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Organization</h1>
                    <p>Manage organization details and branding</p>
                </div>
                {/*organization && (
                    {<button
                        className="btn btn-primary"
                        onClick={() => setShowForm(true)}
                    >
                        <Edit2 size={18} />
                        Edit Organization
                    </button>
                )}*/}
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {isLoading ? (
                <div className="loading-state">Loading organization...</div>
            ) : !organization ? (
                <div className="empty-state">
                    <p>No organization data found</p>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>GSTIN</th>
                                <th>City</th>
                                <th>Website</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{organization.company_name}</td>
                                <td>{organization.gstin || '-'}</td>
                                <td>{organization.city || '-'}</td>
                                <td>{organization.website || '-'}</td>
                                <td>
                                    <button
                                        className="btn-icon btn-primary"
                                        title="Edit Organization"
                                        onClick={() => setShowForm(true)}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <FormModal
                isOpen={showForm}
                title="Edit Organization"
                onSubmit={() => submitOrganizationForm()}
                onCancel={() => setShowForm(false)}
                size="lg"
            >
                <OrganizationForm
                    organization={organization}
                    onSuccess={handleFormSuccess}
                    onError={setError}
                    setLoading={setIsLoading}
                />
            </FormModal>
        </div>
    );
}
