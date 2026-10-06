import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { organizationApi } from '../../../core/api/rbac.api';
import type { Organization } from '../../../core/types/organization.types';
import { Edit2 } from 'lucide-react';
import { FormModal } from '../../../core/components/FormModal';
import { RbacFormSkeleton, RbacPageSkeleton } from '../components/RbacPageSkeleton';
import type { RbacFormHandle } from '../components';
import { useToast } from '../../../core/contexts/useToast';
import { parseApiError } from '../../../core/utils';
import './SettingsPage.css';

const OrganizationForm = lazy(() =>
    import('../components/OrganizationForm').then((module) => ({ default: module.OrganizationForm }))
);

export function OrganizationPage() {
    const toast = useToast();
    const formRef = useRef<RbacFormHandle>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const loadOrganization = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await organizationApi.get();
            setOrganization(res);

        } catch (err: unknown) {
            const message = parseApiError(err instanceof Error ? err.message : 'Failed to load organization details');
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadOrganization();
    }, [loadOrganization]);

    const handleFormSuccess = (updated?: Organization) => {
        if (updated) setOrganization(updated);
        setShowForm(false);
        toast.success('Organization saved successfully');
    };

    return (
        <div className="settings-page">
            {isLoading && !organization ? (
                <RbacPageSkeleton columns={5} rows={1} showToolbar={false} showActionButton={false} />
            ) : (
                <>
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

                    {!organization ? (
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
                                        <td data-label="Company Name">{organization.company_name}</td>
                                        <td data-label="GSTIN">{organization.gstin || '-'}</td>
                                        <td data-label="City">{organization.city || '-'}</td>
                                        <td data-label="Website">{organization.website || '-'}</td>
                                        <td data-label="Actions">
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
                </>
            )}

            <FormModal
                isOpen={showForm}
                title="Edit Organization"
                onSubmit={() => formRef.current?.submit()}
                onCancel={() => setShowForm(false)}
                size="lg"
            >
                <Suspense fallback={<RbacFormSkeleton />}>
                    <OrganizationForm
                        ref={formRef}
                        organization={organization}
                        onSuccess={handleFormSuccess}
                        onError={(err) => toast.error(err)}
                        setLoading={setIsLoading}
                    />
                </Suspense>
            </FormModal>
        </div>
    );
}
