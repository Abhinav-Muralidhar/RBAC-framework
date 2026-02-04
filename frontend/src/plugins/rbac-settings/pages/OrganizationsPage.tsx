import { useEffect, useState } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { OrganizationResponseDto } from '../../../core/types/organization.types';
import { Edit2 } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { OrganizationForm, submitOrganizationForm } from '../components';
import './SettingsPage.css';

export function OrganizationsPage() {
    const [organization, setOrganization] = useState<OrganizationResponseDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        loadOrganization();
    }, []);

    const loadOrganization = async () => {
        setLoading(true);
        try {
            const org = await organizationApi.get();
            setOrganization(org);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load organization');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSuccess = (updatedOrg: OrganizationResponseDto) => {
        // Update local state and close modal
        setOrganization(updatedOrg);
        setShowFormModal(false);
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Organization</h1>
                    <p>Manage your company details</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowFormModal(true)}
                    disabled={!organization}
                >
                    <Edit2 size={18} />
                    Edit Organization
                </button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {loading ? (
                <div className="loading-state">Loading organization...</div>
            ) : organization ? (
                <div className="organization-details">
                    <p><strong>Company Name:</strong> {organization.company_name}</p>
                    <p><strong>GSTIN:</strong> {organization.gstin}</p>
                    <p><strong>Address:</strong> {organization.address}, {organization.city}, {organization.state}, {organization.postal_code}, {organization.country}</p>
                    <p><strong>Phone:</strong> {organization.phone || '-'}</p>
                    <p><strong>Website:</strong> {organization.website || '-'}</p>
                    <p><strong>Status:</strong> {organization.is_active ? 'Active' : 'Inactive'}</p>
                </div>
            ) : (
                <p>No organization found</p>
            )}

            {/* Edit Modal */}
            {organization && (
                <FormModal
                    isOpen={showFormModal}
                    title="Edit Organization"
                    isLoading={formLoading}
                    onSubmit={() => submitOrganizationForm()}
                    onCancel={() => setShowFormModal(false)}
                    size="md"
                >
                    <OrganizationForm
                        organization={organization}
                        onSuccess={handleFormSuccess} // use local handler
                        onError={setError}           // use local error state
                        setLoading={setFormLoading}  // use local loading state
                    />
                </FormModal>
            )}
        </div>
    );
}
