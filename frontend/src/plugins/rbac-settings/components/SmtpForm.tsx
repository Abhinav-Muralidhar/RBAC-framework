/**
 * SMTP Form Component
 * 
 * Create/Edit SMTP configuration form.
 * Uses centralized validators.
 */

import { useState } from 'react';
import { FormInput, FormSelect, FormSwitch } from '../../../core/components/FormElements';
import type {
    SmtpConfig,
    CreateSmtpConfigDto,
    UpdateSmtpConfigDto,
    SmtpEncryption
} from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';
import { validateRequired, validateEmail, validatePort } from '../../../core/utils';

interface SmtpFormProps {
    config?: SmtpConfig | null;
    onSuccess: () => void;
    onError: (error: string) => void;
    setLoading: (loading: boolean) => void;
}

export function SmtpForm({ config, onSuccess, onError, setLoading }: SmtpFormProps) {
    const isEditing = !!config;

    const [formData, setFormData] = useState({
        name: config?.name || '',
        host: config?.host || '',
        port: config?.port ? String(config.port) : '587',
        username: config?.username || '',
        password: '',
        encryption: (config?.encryption ?? 'tls') as SmtpEncryption,
        from_email: config?.from_email || '',
        from_name: config?.from_name || '',
        reply_to_email: config?.reply_to_email || '',
        is_active: config?.is_active ?? false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    // ---------------- VALIDATION ----------------

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        const nameErr = validateRequired(formData.name, 'Name');
        if (nameErr) newErrors.name = nameErr;

        const hostErr = validateRequired(formData.host, 'Host');
        if (hostErr) newErrors.host = hostErr;

        const portErr = validatePort(Number(formData.port));
        if (portErr) newErrors.port = portErr;

        const fromEmailErr = validateEmail(formData.from_email);
        if (fromEmailErr) newErrors.from_email = fromEmailErr;

        if (formData.reply_to_email) {
            const replyErr = validateEmail(formData.reply_to_email);
            if (replyErr) newErrors.reply_to_email = replyErr;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ---------------- SUBMIT ----------------

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);

        try {
            if (isEditing && config) {
                const updateData: UpdateSmtpConfigDto = {
                    name: formData.name,
                    host: formData.host,
                    port: Number(formData.port),
                    username: formData.username || undefined,
                    encryption: formData.encryption,
                    from_email: formData.from_email,
                    from_name: formData.from_name || undefined,
                    reply_to_email: formData.reply_to_email || undefined,
                    is_active: formData.is_active,
                };

                if (formData.password) {
                    updateData.password = formData.password;
                }

                await smtpApi.update(config.id, updateData);
            } else {
                const createData: CreateSmtpConfigDto = {
                    name: formData.name,
                    host: formData.host,
                    port: Number(formData.port),
                    username: formData.username || undefined,
                    password: formData.password || undefined,
                    encryption: formData.encryption,
                    from_email: formData.from_email,
                    from_name: formData.from_name || undefined,
                    reply_to_email: formData.reply_to_email || undefined,
                    is_active: formData.is_active,
                };

                await smtpApi.create(createData);
            }

            onSuccess();
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to save SMTP config');
        } finally {
            setLoading(false);
        }
    };

    // ---------------- UI ----------------

    return (
        <div className="entity-form">

            <FormInput
                label="Configuration Name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                error={errors.name}
                required
            />

            <div className="form-row">
                <FormInput
                    label="Host"
                    value={formData.host}
                    onChange={e => handleChange('host', e.target.value)}
                    error={errors.host}
                    required
                />

                <FormInput
                    label="Port"
                    type="number"
                    value={formData.port}
                    onChange={e => handleChange('port', e.target.value)}
                    error={errors.port}
                    required
                />
            </div>

            <div className="form-row">
                <FormInput
                    label="Username"
                    value={formData.username}
                    onChange={e => handleChange('username', e.target.value)}
                />

                <FormInput
                    label={isEditing ? 'Password (leave blank to keep)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                />
            </div>

            <FormSelect
                label="Encryption"
                value={formData.encryption}
                onChange={e => handleChange('encryption', e.target.value)}
                options={[
                    { value: 'none', label: 'None' },
                    { value: 'ssl', label: 'SSL' },
                    { value: 'tls', label: 'TLS (Recommended)' },
                ]}
            />

            <div className="form-row">
                <FormInput
                    label="From Email"
                    type="email"
                    value={formData.from_email}
                    onChange={e => handleChange('from_email', e.target.value)}
                    error={errors.from_email}
                    required
                />

                <FormInput
                    label="From Name"
                    value={formData.from_name}
                    onChange={e => handleChange('from_name', e.target.value)}
                />
            </div>

            <FormInput
                label="Reply-To Email"
                type="email"
                value={formData.reply_to_email}
                onChange={e => handleChange('reply_to_email', e.target.value)}
                error={errors.reply_to_email}
            />

            <FormSwitch
                label="Set as Active"
                checked={formData.is_active}
                onChange={checked => handleChange('is_active', checked)}
            />

            <button
                type="button"
                id="smtp-form-submit"
                style={{ display: 'none' }}
                onClick={handleSubmit}
            />
        </div>
    );
}

export function submitSmtpForm() {
    document.getElementById('smtp-form-submit')?.click();
}
