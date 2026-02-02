/**
 * SMTP Settings Page
 * 
 * Manage SMTP configurations for email delivery.
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, Mail, Server } from 'lucide-react';
import type { SmtpConfig } from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';
import { ConfirmModal } from '../../../core/components/ConfirmModal';
import { FormModal } from '../../../core/components/FormModal';
import { SmtpForm, submitSmtpForm } from '../components';
import './SettingsPage.css';

export function SmtpPage() {
    const [configs, setConfigs] = useState<SmtpConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<SmtpConfig | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingConfig, setDeletingConfig] = useState<SmtpConfig | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            setLoading(true);
            const data = await smtpApi.list();
            setConfigs(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load SMTP configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingConfig(null);
        setShowFormModal(true);
    };

    const handleEdit = (config: SmtpConfig) => {
        setEditingConfig(config);
        setShowFormModal(true);
    };

    const handleDelete = (config: SmtpConfig) => {
        setDeletingConfig(config);
        setShowDeleteModal(true);
    };

    const handleActivate = async (config: SmtpConfig) => {
        try {
            await smtpApi.activate(config.id);
            loadConfigs();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to activate configuration');
        }
    };

    const confirmDelete = async () => {
        if (!deletingConfig) return;

        setDeleteLoading(true);
        try {
            await smtpApi.delete(deletingConfig.id);
            setShowDeleteModal(false);
            setDeletingConfig(null);
            loadConfigs();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete configuration');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setEditingConfig(null);
        loadConfigs();
    };

    const handleFormError = (err: string) => {
        setError(err);
    };

    if (loading) {
        return <div className="settings-page-loading">Loading...</div>;
    }

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>SMTP Configuration</h1>
                    <p>Manage email server settings for system notifications</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    <Plus size={18} />
                    Add Configuration
                </button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {configs.length === 0 ? (
                <div className="empty-state">
                    <Server size={48} />
                    <h3>No SMTP Configurations</h3>
                    <p>Add your first SMTP server configuration to enable email delivery.</p>
                    <button className="btn btn-primary" onClick={handleCreate}>
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
                            {configs.map(config => (
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
                                            {!config.is_active && (
                                                <button
                                                    className="btn-icon btn-activate"
                                                    onClick={() => handleActivate(config)}
                                                    title="Set as active"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleEdit(config)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon btn-danger"
                                                onClick={() => handleDelete(config)}
                                                title="Delete"
                                                disabled={config.is_active}
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
                isOpen={showFormModal}
                title={editingConfig ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
                isLoading={formLoading}
                onSubmit={() => submitSmtpForm()}
                onCancel={() => {
                    setShowFormModal(false);
                    setEditingConfig(null);
                }}
                size="md"
            >
                <SmtpForm
                    config={editingConfig}
                    onSuccess={handleFormSuccess}
                    onError={handleFormError}
                    setLoading={setFormLoading}
                />
            </FormModal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete SMTP Configuration"
                message="Are you sure you want to delete this SMTP configuration? This action cannot be undone."
                itemName={deletingConfig?.name}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeletingConfig(null);
                }}
            />
        </div>
    );
}
