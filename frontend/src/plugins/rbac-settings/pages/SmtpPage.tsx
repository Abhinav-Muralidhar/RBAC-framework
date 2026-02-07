/**
 * SMTP Settings Page
 * 
 * Manage SMTP configurations for email delivery.
 */

import { useState } from 'react';
import { Plus, Edit2, Trash2, Check, Mail, Server } from 'lucide-react';
import type { SmtpConfig } from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { SmtpForm, submitSmtpForm } from '../components';
import { useCrudPage } from '../../../core/hooks';
import './SettingsPage.css';

// Wrapper for smtpApi.list to match useCrudPage expected format
const listSmtpConfigs = async () => {
    const data = await smtpApi.list();
    return { data };
};

export function SmtpPage() {
    const crud = useCrudPage<SmtpConfig>({
        listFn: listSmtpConfigs,
        deleteFn: smtpApi.delete,
        entityName: 'SMTP configurations',
    });

    /*const [activating, setActivating] = useState<string | null>(null);

    const handleActivate = async (config: SmtpConfig) => {
        setActivating(config.id);
        try {
            await smtpApi.activate(config.id);
            crud.reload();
        } catch (err) {
            crud.setError(err instanceof Error ? err.message : 'Failed to activate configuration');
        } finally {
            setActivating(null);
        }
    };*/

    if (crud.isLoading) {
        return <div className="settings-page-loading">Loading...</div>;
    }

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>SMTP Configuration</h1>
                    <p>Manage email server settings for system notifications</p>
                </div>
                <button className="btn btn-primary" onClick={crud.openCreate}>
                    <Plus size={18} />
                    Add Configuration
                </button>
            </header>

            {crud.error && (
                <div className="error-banner">
                    {crud.error}
                    <button onClick={crud.clearError}>×</button>
                </div>
            )}

            {crud.items.length === 0 ? (
                <div className="empty-state">
                    <Server size={48} />
                    <h3>No SMTP Configurations</h3>
                    <p>Add your first SMTP server configuration to enable email delivery.</p>
                    <button className="btn btn-primary" onClick={crud.openCreate}>
                        <Plus size={18} />
                        Add Configuration
                    </button>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Host</th>
                                <th className="hide-mobile">Port</th>
                                <th className="hide-mobile">From</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {crud.items.map(config => (
                                <tr key={config.id}>
                                    <td>
                                        <div className="cell-primary">
                                            <Mail size={16} />
                                            {config.name}
                                        </div>
                                    </td>
                                    <td>{config.host}</td>
                                    <td className="hide-mobile">{config.port}</td>
                                    <td className="hide-mobile">{config.from_email}</td>
                                    <td>
                                        {config.is_active ? (
                                            <span className="status-badge status-active">
                                                <Check size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="status-badge status-inactive">
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            {/* {!config.is_active && (
                                                <button
                                                    className="btn-icon btn-activate"
                                                    onClick={() => handleActivate(config)}
                                                    title="Set as active"
                                                    disabled={activating === config.id}
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )} */}
                                            <button
                                                className="btn-icon"
                                                onClick={() => crud.openEdit(config)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                onClick={() => crud.openDelete(config)}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <FormModal
                isOpen={crud.showFormModal}
                title={crud.editingItem ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
                isLoading={crud.formLoading}
                onSubmit={() => submitSmtpForm()}
                onCancel={crud.closeForm}
                size="md"
            >
                <SmtpForm
                    config={crud.editingItem}
                    onSuccess={crud.handleFormSuccess}
                    onError={crud.setError}
                    setLoading={crud.setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={crud.showDeleteModal}
                title="Delete SMTP Configuration"
                message="Are you sure you want to delete this SMTP configuration? This action cannot be undone."
                itemName={crud.deletingItem?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={crud.deleteLoading}
                onConfirm={crud.confirmDelete}
                onCancel={crud.closeDelete}
            />
        </div>
    );
}
