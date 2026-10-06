/**
 * SMTP Settings Page
 * 
 * Manage SMTP configuration for email delivery.
 * Refactored to single-instance view (similar to Organization settings).
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Edit2 } from 'lucide-react';
import type { SmtpConfig } from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';
import { FormModal } from '../../../core/components/FormModal';
import { RbacFormSkeleton, RbacPageSkeleton } from '../components/RbacPageSkeleton';
import type { RbacFormHandle } from '../components';
import { useToast } from '../../../core/contexts/useToast';
import { parseApiError } from '../../../core/utils';
import './SettingsPage.css';

const SmtpForm = lazy(() => import('../components/SmtpForm').then((module) => ({ default: module.SmtpForm })));

export function SmtpPage() {
    const toast = useToast();
    const formRef = useRef<RbacFormHandle>(null);
    const [config, setConfig] = useState<SmtpConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const loadConfig = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await smtpApi.getActive();
            setConfig(res);
        } catch (err: unknown) {
            const message = parseApiError(err instanceof Error ? err.message : 'Failed to load SMTP configuration');
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    const handleFormSuccess = (updated?: SmtpConfig) => {
        if (updated) setConfig(updated);
        else loadConfig();
        setShowForm(false);
        toast.success('SMTP configuration saved successfully');
    };

    return (
        <div className="settings-page">
            {isLoading && !config ? (
                <RbacPageSkeleton columns={5} rows={1} showToolbar={false} showActionButton={false} />
            ) : (
                <>
                    <header className="page-header">
                        <div>
                            <h1>SMTP Configuration</h1>
                            <p>Manage email server settings for system notifications</p>
                        </div>
                    </header>

                    {!config ? (
                        <div className="empty-state">
                            <Mail size={48} />
                            <h3>No SMTP Configuration</h3>
                            <p>Please contact your administrator to set up the system SMTP configuration.</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Host</th>
                                        <th>Port</th>
                                        <th>From Email</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td data-label="Name">
                                            <div className="cell-primary">
                                                <Mail size={16} />
                                                {config.name}
                                            </div>
                                        </td>
                                        <td data-label="Host">{config.host}</td>
                                        <td data-label="Port">{config.port}</td>
                                        <td data-label="From">{config.from_email}</td>
                                        <td data-label="Actions">
                                            <button
                                                className="btn-icon btn-primary"
                                                title="Edit Configuration"
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
                title="Edit SMTP Configuration"
                onSubmit={() => formRef.current?.submit()}
                onCancel={() => setShowForm(false)}
                size="md"
            >
                <Suspense fallback={<RbacFormSkeleton />}>
                    <SmtpForm
                        ref={formRef}
                        config={config}
                        onSuccess={handleFormSuccess}
                        onError={(err) => toast.error(err)}
                        setLoading={setIsLoading}
                    />
                </Suspense>
            </FormModal>
        </div>
    );
}
