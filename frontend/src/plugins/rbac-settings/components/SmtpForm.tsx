/**
 * SMTP Form Component
 * 
 * Create/Edit SMTP configuration form.
 */

import { useState } from 'react';
import { FormInput, FormSelect, FormSwitch } from '../../../core/components/FormElements';
import type { SmtpConfig, CreateSmtpConfigDto, UpdateSmtpConfigDto, SmtpEncryption } from '../../../core/types/smtp.types';
import { smtpApi } from '../../../core/api/rbac.api';

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
        port: config?.port?.toString() || '587',
        username: config?.username || '',
        password: '',
        encryption: config?.encryption || 'tls' as SmtpEncryption,
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

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }
        if (!formData.host.trim()) {
            newErrors.host = 'Host is required';
        }
        if (!formData.port || isNaN(Number(formData.port))) {
            newErrors.port = 'Valid port is required';
        }
        if (!formData.from_email.trim()) {
            newErrors.from_email = 'From email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.from_email)) {
            newErrors.from_email = 'Invalid email format';
        }
        if (formData.reply_to_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.reply_to_email)) {
            newErrors.reply_to_email = 'Invalid email format';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

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
                    encryption: formData.encryption as SmtpEncryption,
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
                    encryption: formData.encryption as SmtpEncryption,
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

    return (
        <div className="entity-form">
            <FormInput
                label="Configuration Name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                error={errors.name}
                required
                placeholder="e.g., Primary Email Server"
            />

            <div className="form-row">
                <FormInput
                    label="Host"
                    value={formData.host}
                    onChange={e => handleChange('host', e.target.value)}
                    error={errors.host}
                    required
                    placeholder="e.g., smtp.example.com"
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
                    placeholder="SMTP username (if required)"
                />
                <FormInput
                    label={isEditing ? 'Password (leave blank to keep)' : 'Password'}
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder="SMTP password (if required)"
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
                    placeholder="noreply@example.com"
                />
                <FormInput
                    label="From Name"
                    value={formData.from_name}
                    onChange={e => handleChange('from_name', e.target.value)}
                    placeholder="e.g., RBAC System"
                />
            </div>

            <FormInput
                label="Reply-To Email"
                type="email"
                value={formData.reply_to_email}
                onChange={e => handleChange('reply_to_email', e.target.value)}
                error={errors.reply_to_email}
                placeholder="support@example.com (optional)"
            />

            <FormSwitch
                label="Set as Active"
                checked={formData.is_active}
                onChange={checked => handleChange('is_active', checked)}
                hint="Only one SMTP configuration can be active at a time"
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
