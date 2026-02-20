import { useEffect, useState } from 'react';
import { sharingRulesApi } from '../../../core/api/rbac.api';
import type { SharingRule } from '../../../core/types/sharingrule.types';
import { parseApiError } from '../../../core/utils';
import { Search, Filter } from 'lucide-react';
import './SettingsPage.css';

export function SharingRules() {
    const [rules, setRules] = useState<SharingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Load rules from API
    const loadRules = async () => {
        try {
            setLoading(true);
            const res = await sharingRulesApi.list();
            const rulesData: SharingRule[] = (res as any || []).map(r => ({
                id: Number(r.id),
                version: Number(r.version),
                rule_type: r.rule_type,
                module_id: Number(r.module_id),
                is_active: r.is_active,
                created_at: r.created_at,
                created_by: Number(r.created_by),
                name: r.name,
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

    const filteredRules = rules.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rule_type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="settings-page">
            <header className="page-header">
                <div>
                    <h1>Module Visibility</h1>
                    <p>Toggle modules between Public and Private</p>
                </div>
            </header>

            <div className="page-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search modules..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading && <div className="loading-state">Loading sharing rules...</div>}
            {error && <div className="error-banner">{error}</div>}

            {!loading && (
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
                            {filteredRules.map(rule => (
                                <tr key={rule.id}>
                                    <td data-label="Module" className="font-medium">{rule.name}</td>

                                    {/* Rule Type Toggle */}
                                    <td data-label="Rule Type">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const newType = rule.rule_type === 'public' ? 'private' : 'public';
                                                            const updated = await sharingRulesApi.update(rule.id, { version: rule.version, rule_type: newType });
                                                            setRules(prev =>
                                                                prev.map(r => r.id === rule.id ? { ...r, rule_type: newType, version: updated.version } : r)
                                                            );
                                                        } catch (err) {
                                                            const raw = err instanceof Error ? err.message : 'Failed to update rule type';
                                                            setError(parseApiError(raw));
                                                        }
                                                    }}
                                            className={`btn btn-min ${rule.rule_type === 'public' ? 'btn-primary' : 'btn-secondary'}`}
                                        >
                                            {rule.rule_type === 'public' ? 'Public' : 'Private'}
                                        </button>
                                    </td>

                                    {/* Status Toggle */}
                                    <td data-label="Status">
                                        <div className="form-switch-wrapper">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={rule.is_active}
                                                className={`form-switch ${rule.is_active ? 'form-switch--on' : ''}`}
                                                onClick={async () => {
                                                    try {
                                                        const newStatus = !rule.is_active;
                                                        const updated = await sharingRulesApi.update(rule.id, { version: rule.version, is_active: newStatus });
                                                        setRules(prev =>
                                                            prev.map(r => r.id === rule.id ? { ...r, is_active: newStatus, version: updated.version } : r)
                                                        );
                                                    } catch (err) {
                                                        const raw = err instanceof Error ? err.message : 'Failed to update rule status';
                                                        setError(parseApiError(raw));
                                                    }
                                                }}
                                            >
                                                <span className="form-switch__thumb" />
                                            </button>
                                            <label className="form-switch-label">
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRules.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="empty-state">No sharing rules found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
