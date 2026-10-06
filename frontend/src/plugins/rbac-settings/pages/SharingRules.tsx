import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { sharingRulesApi } from '../../../core/api/rbac.api';
import type { SharingRule } from '../../../core/types/sharingrule.types';
import { createPaginatedSource, usePaginatedData } from '../../../core/hooks';
import { FormModal } from '../../../core/components/FormModal';
import { parseApiError } from '../../../core/utils';
import { RbacPageSkeleton } from '../components/RbacPageSkeleton';
import './SettingsPage.css';

export function SharingRules() {
    const {
        data: rules,
        isLoading,
        page,
        totalPages,
        limit,
        limitOptions,
        setPage,
        setLimit,
        filters,
        draftFilters,
        setDraftFilters,
        filterModal,
    } = usePaginatedData<SharingRule>(createPaginatedSource('sharingRules', sharingRulesApi.list));

    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRules = rules.filter(r =>
        (r.name || r.module_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rule_type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const updateRuleLocal = (id: number, changes: Partial<SharingRule>) => {
        rules.forEach(rule => {
            if (rule.id === id) {
                Object.assign(rule, changes);
            }
        });
    };

    return (
        <div className="settings-page">
            {isLoading && rules.length === 0 ? (
                <RbacPageSkeleton columns={3} rows={4} showActionButton={false} />
            ) : (
                <>
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

                        <button
                            className={`btn ${Object.keys(filters).length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={filterModal.open}
                        >
                            <Filter size={18} /> Filter
                            {Object.keys(filters).length > 0 && (
                                <span className="badge">{Object.keys(filters).length}</span>
                            )}
                        </button>
                    </div>

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
                                {filteredRules.map(rule => (
                                    <tr key={rule.id}>
                                        <td data-label="Module" className="font-medium">
                                            {rule.name || rule.module_name || `Module ${rule.module_id}`}
                                        </td>

                                        {/* Rule Type Toggle */}
                                        <td data-label="Rule Type">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const newType =
                                                            rule.rule_type === 'public'
                                                                ? 'private'
                                                                : 'public';

                                                        const updated = await sharingRulesApi.update(rule.id, {
                                                            version: rule.version,
                                                            rule_type: newType,
                                                        });

                                                        updateRuleLocal(rule.id, {
                                                            rule_type: newType,
                                                            version: updated.version,
                                                        });

                                                        setError(null);
                                                    } catch (err) {
                                                        const raw =
                                                            err instanceof Error
                                                                ? err.message
                                                                : 'Failed to update rule type';
                                                        setError(parseApiError(raw));
                                                    }
                                                }}
                                                className={`btn btn-min ${
                                                    rule.rule_type === 'public'
                                                        ? 'btn-primary'
                                                        : 'btn-secondary'
                                                }`}
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
                                                    className={`form-switch ${
                                                        rule.is_active ? 'form-switch--on' : ''
                                                    }`}
                                                    onClick={async () => {
                                                        try {
                                                            const newStatus = !rule.is_active;

                                                            const updated =
                                                                await sharingRulesApi.update(rule.id, {
                                                                    version: rule.version,
                                                                    is_active: newStatus,
                                                                });

                                                            updateRuleLocal(rule.id, {
                                                                is_active: newStatus,
                                                                version: updated.version,
                                                            });

                                                            setError(null);
                                                        } catch (err) {
                                                            const raw =
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : 'Failed to update rule status';
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
                                        <td colSpan={3} className="empty-state">
                                            No sharing rules found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination">
                        <div className="page-size">
                            <label className="form-label">Rows</label>
                            <select
                                className="form-control"
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                            >
                                {limitOptions.map(option => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            Previous
                        </button>

                        <span>
                            Page {page} of {totalPages}
                        </span>

                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            {/* Filter Modal */}
            <FormModal
                isOpen={filterModal.isOpen}
                title="Filter Sharing Rules"
                onSubmit={filterModal.submit}
                onCancel={filterModal.close}
                size="sm"
            >
                <div className="filter-form">
                    <div className="form-field">
                        <label className="form-label">Status</label>

                        <select
                            className="form-control"
                            value={
                                draftFilters.is_active === undefined
                                    ? ''
                                    : draftFilters.is_active.toString()
                            }
                            onChange={(e) =>
                                setDraftFilters({
                                    ...draftFilters,
                                    is_active:
                                        e.target.value === ''
                                            ? undefined
                                            : e.target.value === 'true',
                                })
                            }
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>

                    {Object.keys(draftFilters).length > 0 && (
                        <button
                            type="button"
                            className="btn btn-text filter-clear"
                            onClick={() => setDraftFilters({})}
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            </FormModal>
        </div>
    );
}
