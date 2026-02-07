import { useEffect, useState } from 'react';
import { sharingRulesApi } from '../../../core/api/rbac.api';
import type { SharingRule, UpdateSharingRuleDto } from '../../../core/types/sharingrule.types';
import './SettingsPage.css';

export function SharingRules() {
    const [rules, setRules] = useState<SharingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]); // track toggles in progress

    // Load rules from API
    const loadRules = async () => {
        try {
            setLoading(true);
            const res = await sharingRulesApi.list();
            const rulesData: SharingRule[] = (res as any || []).map(r => ({
                id: Number(r.id),
                rule_type: r.rule_type,
                module_id: Number(r.module_id),
                is_active: r.is_active,
                created_at: r.created_at,
                created_by: Number(r.created_by),
                name: r.name, // include module name
            }));
            setRules(rulesData);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load sharing rules');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    // Toggle Public/Private (optimistic update)
    const toggleRule = async (rule: SharingRule) => {
        const updated: UpdateSharingRuleDto = { is_active: !rule.is_active };

        // Optimistic update
        setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)));
        setUpdatingIds(prev => [...prev, rule.id]);

        try {
            await sharingRulesApi.update(rule.id, updated);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to update rule');
            // rollback if API fails
            setRules(prev => prev.map(r => (r.id === rule.id ? rule : r)));
        } finally {
            setUpdatingIds(prev => prev.filter(id => id !== rule.id));
        }
    };

    // Optional: submit all rules at once
    const handleSubmit = async () => {
        try {
            setLoading(true);
            await Promise.all(rules.map(r => sharingRulesApi.update(r.id, { is_active: r.is_active })));
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to save sharing rules');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Module Visibility</h1>
                    <p>Toggle modules between Public and Private</p>
                </div>
            </header>

            {loading && <div className="loading-state">Loading sharing rules...</div>}
            {error && <div className="error-banner">{error}</div>}

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Module</th>
                            <th>Rule Type</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map(rule => (
                            <tr key={rule.id}>
                                <td>{rule.name}</td>
                                <td>
                                    <button
                                        onClick={() => toggleRule(rule)}
                                        disabled={updatingIds.includes(rule.id)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: updatingIds.includes(rule.id) ? 'not-allowed' : 'pointer',
                                            backgroundColor: rule.is_active ? '#3b82f6' : '#2d2d44',
                                            color: '#fff',
                                            minWidth: '80px',
                                            transition: '0.2s',
                                        }}
                                    >
                                        {updatingIds.includes(rule.id)
                                            ? 'Updating...'
                                            : rule.is_active
                                                ? 'Public'
                                                : 'Private'}
                                    </button>
                                </td>
                                <td>
                                    <button
                                        onClick={() => toggleRule(rule)}
                                        disabled={updatingIds.includes(rule.id)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: updatingIds.includes(rule.id) ? 'not-allowed' : 'pointer',
                                            backgroundColor: rule.is_active ? '#16a34a' : '#ef4444',
                                            color: '#fff',
                                            minWidth: '80px',
                                            transition: '0.2s',
                                        }}
                                    >
                                        {updatingIds.includes(rule.id)
                                            ? 'Updating...'
                                            : rule.is_active
                                                ? 'Active'
                                                : 'Inactive'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Optional: Save All button */}
            {/* <button onClick={handleSubmit}>Save All Changes</button> */}
        </div>
    );
}
