import React, { useState, useEffect } from 'react';
import type { PolicyStatement, UserProfile } from '../types';
import { supa as supabase } from '../offline/client';
import Spinner from './common/Spinner';
import { BookOpenIcon, PlusCircleIcon, PencilIcon, CheckCircleIcon, CloseIcon } from './common/icons';

interface PolicyStatementsManagerProps {
    userProfile: UserProfile;
    onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface PolicyFormData {
    title: string;
    content: string;
    version: string;
    target_audience: ('student' | 'staff')[];
    is_active: boolean;
    requires_acknowledgment: boolean;
    effective_date: string;
}

const PolicyStatementsManager: React.FC<PolicyStatementsManagerProps> = ({
    userProfile,
    onShowToast,
}) => {
    const [policies, setPolicies] = useState<PolicyStatement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<PolicyStatement | null>(null);
    const [formData, setFormData] = useState<PolicyFormData>({
        title: '',
        content: '',
        version: '1.0',
        target_audience: ['student', 'staff'],
        is_active: true,
        requires_acknowledgment: true,
        effective_date: new Date().toISOString().split('T')[0],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [acknowledgmentStats, setAcknowledgmentStats] = useState<Record<number, { total: number; acknowledged: number }>>({});

    useEffect(() => {
        loadPolicies();
    }, [userProfile.school_id]);

    const loadPolicies = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('policy_statements')
                .select('*')
                .eq('school_id', userProfile.school_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPolicies(data || []);

            // Load acknowledgment statistics
            if (data && data.length > 0) {
                await loadAcknowledgmentStats(data);
            }
        } catch (error) {
            console.error('Failed to load policies:', error);
            onShowToast('Failed to load policies', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const loadAcknowledgmentStats = async (policyList: PolicyStatement[]) => {
        try {
            // Get all users count
            const { count: staffCount } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', userProfile.school_id);

            const { count: studentCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', userProfile.school_id);

            const stats: Record<number, { total: number; acknowledged: number }> = {};

            for (const policy of policyList) {
                let total = 0;
                let acknowledged = 0;

                // Count staff if target includes staff
                if (policy.target_audience.includes('staff')) {
                    total += staffCount || 0;

                    // Count staff who acknowledged
                    const { data: staffProfiles } = await supabase
                        .from('user_profiles')
                        .select('policy_acknowledgments')
                        .eq('school_id', userProfile.school_id);

                    if (staffProfiles) {
                        for (const profile of staffProfiles) {
                            const acks = profile.policy_acknowledgments || [];
                            if (acks.some((ack: any) => ack.policy_id === policy.id && ack.policy_version === policy.version)) {
                                acknowledged++;
                            }
                        }
                    }
                }

                // Count students if target includes student
                if (policy.target_audience.includes('student')) {
                    total += studentCount || 0;

                    // Count students who acknowledged
                    const { data: students } = await supabase
                        .from('students')
                        .select('policy_acknowledgments')
                        .eq('school_id', userProfile.school_id);

                    if (students) {
                        for (const student of students) {
                            const acks = student.policy_acknowledgments || [];
                            if (acks.some((ack: any) => ack.policy_id === policy.id && ack.policy_version === policy.version)) {
                                acknowledged++;
                            }
                        }
                    }
                }

                stats[policy.id] = { total, acknowledged };
            }

            setAcknowledgmentStats(stats);
        } catch (error) {
            console.error('Failed to load acknowledgment stats:', error);
        }
    };

    const handleCreate = () => {
        setEditingPolicy(null);
        setFormData({
            title: '',
            content: '',
            version: '1.0',
            target_audience: ['student', 'staff'],
            is_active: true,
            requires_acknowledgment: true,
            effective_date: new Date().toISOString().split('T')[0],
        });
        setShowForm(true);
    };

    const handleEdit = (policy: PolicyStatement) => {
        setEditingPolicy(policy);
        setFormData({
            title: policy.title,
            content: policy.content,
            version: policy.version,
            target_audience: policy.target_audience,
            is_active: policy.is_active,
            requires_acknowledgment: policy.requires_acknowledgment,
            effective_date: policy.effective_date,
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim() || !formData.content.trim()) {
            onShowToast('Title and content are required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            if (editingPolicy) {
                // Update existing policy
                const { error } = await supabase
                    .from('policy_statements')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingPolicy.id);

                if (error) throw error;
                onShowToast('Policy updated successfully', 'success');
            } else {
                // Create new policy
                const { error } = await supabase
                    .from('policy_statements')
                    .insert({
                        ...formData,
                        school_id: userProfile.school_id,
                        created_by: userProfile.id,
                    });

                if (error) throw error;
                onShowToast('Policy created successfully', 'success');
            }

            setShowForm(false);
            loadPolicies();
        } catch (error) {
            console.error('Failed to save policy:', error);
            onShowToast('Failed to save policy', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (policy: PolicyStatement) => {
        try {
            const { error } = await supabase
                .from('policy_statements')
                .update({ is_active: !policy.is_active })
                .eq('id', policy.id);

            if (error) throw error;
            onShowToast(
                `Policy ${!policy.is_active ? 'activated' : 'deactivated'} successfully`,
                'success'
            );
            loadPolicies();
        } catch (error) {
            console.error('Failed to toggle policy status:', error);
            onShowToast('Failed to update policy status', 'error');
        }
    };

    const handleAudienceChange = (audience: 'student' | 'staff') => {
        setFormData(prev => {
            const currentAudience = [...prev.target_audience];
            if (currentAudience.includes(audience)) {
                return {
                    ...prev,
                    target_audience: currentAudience.filter(a => a !== audience) as ('student' | 'staff')[],
                };
            } else {
                return {
                    ...prev,
                    target_audience: [...currentAudience, audience] as ('student' | 'staff')[],
                };
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
                <p className="ml-4 text-slate-600 dark:text-slate-300">Loading policies...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                        <BookOpenIcon className="w-8 h-8 mr-3 text-blue-600" />
                        Policy Statements Manager
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                        Create and manage policy statements that require user acknowledgment.
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    Create Policy
                </button>
            </div>

            {/* Policy List */}
            <div className="space-y-4">
                {policies.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                        <BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-500 dark:text-slate-400">No policies created yet.</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                            Click "Create Policy" to add your first policy statement.
                        </p>
                    </div>
                ) : (
                    policies.map(policy => {
                        const stats = acknowledgmentStats[policy.id] || { total: 0, acknowledged: 0 };
                        const percentage = stats.total > 0 ? Math.round((stats.acknowledged / stats.total) * 100) : 0;

                        return (
                            <div
                                key={policy.id}
                                className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/40"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                                {policy.title}
                                            </h3>
                                            <span
                                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                    policy.is_active
                                                        ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                                        : 'bg-gray-500/20 text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                {policy.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                            <p>Version: {policy.version}</p>
                                            <p>Effective Date: {new Date(policy.effective_date).toLocaleDateString()}</p>
                                            <p>Target: {policy.target_audience.join(', ')}</p>
                                            <p>Requires Acknowledgment: {policy.requires_acknowledgment ? 'Yes' : 'No'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(policy)}
                                            className="px-3 py-2 text-sm bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-500/30"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(policy)}
                                            className="px-3 py-2 text-sm bg-slate-500/20 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-500/30"
                                        >
                                            {policy.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                </div>

                                {/* Acknowledgment Stats */}
                                {policy.requires_acknowledgment && (
                                    <div className="mt-4 p-4 bg-slate-500/10 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Acknowledgment Progress
                                            </span>
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {stats.acknowledged} / {stats.total} ({percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-300/30 dark:bg-slate-700/30 rounded-full h-2">
                                            <div
                                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Preview of content */}
                                <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                                        {policy.content}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Policy Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="rounded-2xl border border-slate-200/60 bg-white/90 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/90 w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {editingPolicy ? 'Edit Policy Statement' : 'Create Policy Statement'}
                            </h2>
                            <button
                                onClick={() => setShowForm(false)}
                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Policy Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Student Code of Conduct"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Policy Content * (Markdown supported)
                                </label>
                                <textarea
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    rows={12}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                    placeholder="Enter policy content here. Use markdown formatting: # Heading, ## Subheading, - List items"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Version
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.version}
                                        onChange={e => setFormData({ ...formData, version: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="1.0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Effective Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.effective_date}
                                        onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Target Audience
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.target_audience.includes('staff')}
                                            onChange={() => handleAudienceChange('staff')}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">Staff</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.target_audience.includes('student')}
                                            onChange={() => handleAudienceChange('student')}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">Students</span>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.requires_acknowledgment}
                                        onChange={e =>
                                            setFormData({ ...formData, requires_acknowledgment: e.target.checked })
                                        }
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Requires Acknowledgment
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end gap-3">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 bg-slate-500/20 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-500/30"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !formData.title.trim() || !formData.content.trim()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Spinner size="sm" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircleIcon className="w-5 h-5" />
                                        <span>{editingPolicy ? 'Update' : 'Create'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PolicyStatementsManager;
