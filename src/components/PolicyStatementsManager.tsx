import React, { useState, useEffect } from 'react';
import type { PolicyStatement, UserProfile, PolicyAcknowledgment } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
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

interface ComplianceUser {
    id: string | number;
    name: string;
    role?: string;
    class_name?: string;
    email?: string;
    acknowledged_at?: string;
    full_name_entered?: string;
    type: 'staff' | 'student';
}

interface ComplianceData {
    acknowledged: ComplianceUser[];
    pending: ComplianceUser[];
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
    
    // Compliance dashboard state
    const [expandedPolicyId, setExpandedPolicyId] = useState<number | null>(null);
    const [complianceTab, setComplianceTab] = useState<'acknowledged' | 'pending'>('acknowledged');
    const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
    const [complianceFilter, setComplianceFilter] = useState<'all' | 'staff' | 'student'>('all');
    const [complianceSearch, setComplianceSearch] = useState('');
    const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);

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
            // Fetch all data in parallel
            const [
                { count: staffCount },
                { count: studentCount },
                { data: staffProfiles },
                { data: students }
            ] = await Promise.all([
                supabase
                    .from('user_profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('school_id', userProfile.school_id),
                supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('school_id', userProfile.school_id),
                supabase
                    .from('user_profiles')
                    .select('policy_acknowledgments')
                    .eq('school_id', userProfile.school_id),
                supabase
                    .from('students')
                    .select('policy_acknowledgments')
                    .eq('school_id', userProfile.school_id)
            ]);

            const stats: Record<number, { total: number; acknowledged: number }> = {};

            for (const policy of policyList) {
                let total = 0;
                let acknowledged = 0;

                // Count staff if target includes staff
                if (policy.target_audience.includes('staff')) {
                    total += staffCount || 0;

                    // Count staff who acknowledged
                    if (staffProfiles) {
                        for (const profile of staffProfiles) {
                            const acks = (profile.policy_acknowledgments || []) as PolicyAcknowledgment[];
                            if (acks.some((ack) => ack.policy_id === policy.id && ack.policy_version === policy.version)) {
                                acknowledged++;
                            }
                        }
                    }
                }

                // Count students if target includes student
                if (policy.target_audience.includes('student')) {
                    total += studentCount || 0;

                    // Count students who acknowledged
                    if (students) {
                        for (const student of students) {
                            const acks = (student.policy_acknowledgments || []) as PolicyAcknowledgment[];
                            if (acks.some((ack) => ack.policy_id === policy.id && ack.policy_version === policy.version)) {
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

    const loadComplianceDetails = async (policy: PolicyStatement) => {
        setIsLoadingCompliance(true);
        try {
            // Fetch acknowledgments from the new policy_acknowledgments table
            const { data: acknowledgments, error: ackError } = await supabase
                .from('policy_acknowledgments')
                .select(`
                    *,
                    user_profiles:user_id (id, name, role, email),
                    students:student_id (id, name, email, class:classes(name))
                `)
                .eq('policy_id', policy.id)
                .eq('policy_version', policy.version);

            if (ackError) throw ackError;

            // Build acknowledged list
            const acknowledged: ComplianceUser[] = (acknowledgments || []).map((ack: any) => {
                if (ack.user_profiles) {
                    return {
                        id: ack.user_profiles.id,
                        name: ack.user_profiles.name,
                        role: ack.user_profiles.role,
                        email: ack.user_profiles.email,
                        acknowledged_at: ack.acknowledged_at,
                        full_name_entered: ack.full_name_entered,
                        type: 'staff' as const
                    };
                } else if (ack.students) {
                    return {
                        id: ack.students.id,
                        name: ack.students.name,
                        class_name: ack.students.class?.name,
                        email: ack.students.email,
                        acknowledged_at: ack.acknowledged_at,
                        full_name_entered: ack.full_name_entered,
                        type: 'student' as const
                    };
                }
                return null;
            }).filter(Boolean) as ComplianceUser[];

            // Fetch all users and students to find who's pending
            const pending: ComplianceUser[] = [];

            if (policy.target_audience.includes('staff')) {
                const { data: allStaff } = await supabase
                    .from('user_profiles')
                    .select('id, name, role, email')
                    .eq('school_id', userProfile.school_id);

                if (allStaff) {
                    const acknowledgedStaffIds = new Set(
                        acknowledged.filter(u => u.type === 'staff').map(u => u.id)
                    );
                    
                    for (const staff of allStaff) {
                        if (!acknowledgedStaffIds.has(staff.id)) {
                            pending.push({
                                id: staff.id,
                                name: staff.name,
                                role: staff.role,
                                email: staff.email,
                                type: 'staff'
                            });
                        }
                    }
                }
            }

            if (policy.target_audience.includes('student')) {
                const { data: allStudents } = await supabase
                    .from('students')
                    .select('id, name, email, class:classes(name)')
                    .eq('school_id', userProfile.school_id);

                if (allStudents) {
                    const acknowledgedStudentIds = new Set(
                        acknowledged.filter(u => u.type === 'student').map(u => u.id)
                    );
                    
                    for (const student of allStudents) {
                        if (!acknowledgedStudentIds.has(student.id)) {
                            pending.push({
                                id: student.id,
                                name: student.name,
                                class_name: student.class?.name,
                                email: student.email,
                                type: 'student'
                            });
                        }
                    }
                }
            }

            setComplianceData({ acknowledged, pending });
        } catch (error) {
            console.error('Failed to load compliance details:', error);
            onShowToast('Failed to load compliance details', 'error');
        } finally {
            setIsLoadingCompliance(false);
        }
    };

    const toggleComplianceSection = (policyId: number, policy: PolicyStatement) => {
        if (expandedPolicyId === policyId) {
            // Collapse
            setExpandedPolicyId(null);
            setComplianceData(null);
            setComplianceSearch('');
            setComplianceFilter('all');
            setComplianceTab('acknowledged');
        } else {
            // Expand
            setExpandedPolicyId(policyId);
            setComplianceSearch('');
            setComplianceFilter('all');
            setComplianceTab('acknowledged');
            loadComplianceDetails(policy);
        }
    };

    const exportComplianceCSV = (policyTitle: string, data: ComplianceData, tab: 'acknowledged' | 'pending') => {
        const rows = tab === 'acknowledged' 
            ? data.acknowledged.map(u => ({
                Name: u.name,
                Type: u.type,
                Role: u.role || u.class_name || '',
                Email: u.email || '',
                'Acknowledged Date': u.acknowledged_at ? new Date(u.acknowledged_at).toLocaleDateString() : '',
                'Signature': u.full_name_entered || ''
              }))
            : data.pending.map(u => ({
                Name: u.name,
                Type: u.type,
                Role: u.role || u.class_name || '',
                Email: u.email || ''
              }));

        // Check if there's data to export
        if (rows.length === 0) {
            onShowToast('No data to export', 'info');
            return;
        }

        // Helper function to escape CSV values
        const escapeCSV = (val: any): string => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            // Escape quotes by doubling them, wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Convert to CSV
        const headers = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => 
            Object.values(row).map(val => escapeCSV(val)).join(',')
        );
        const csv = [headers, ...csvRows].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${policyTitle.replace(/[^a-z0-9]/gi, '_')}_${tab}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        onShowToast('CSV exported successfully', 'success');
    };

    const getFilteredComplianceData = () => {
        if (!complianceData) return [];
        
        const dataToFilter = complianceTab === 'acknowledged' ? complianceData.acknowledged : complianceData.pending;
        
        // Move search term processing outside the loop
        const searchLower = complianceSearch.toLowerCase();
        
        return dataToFilter.filter(user => {
            // Apply type filter
            if (complianceFilter !== 'all' && user.type !== complianceFilter) {
                return false;
            }
            
            // Apply search filter
            if (complianceSearch) {
                const userName = user.name || '';
                return (
                    userName.toLowerCase().includes(searchLower) ||
                    (user.email && user.email.toLowerCase().includes(searchLower)) ||
                    (user.role && user.role.toLowerCase().includes(searchLower)) ||
                    (user.class_name && user.class_name.toLowerCase().includes(searchLower))
                );
            }
            
            return true;
        });
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

                                {/* Acknowledgment Stats with Expandable Compliance Dashboard */}
                                {policy.requires_acknowledgment && (
                                    <div className="mt-4">
                                        <div 
                                            className="p-4 bg-slate-500/10 rounded-lg cursor-pointer hover:bg-slate-500/15 transition-colors"
                                            onClick={() => toggleComplianceSection(policy.id, policy)}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Acknowledgment Progress
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                                        {stats.acknowledged} / {stats.total} ({percentage}%)
                                                    </span>
                                                    <svg 
                                                        className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${
                                                            expandedPolicyId === policy.id ? 'rotate-180' : ''
                                                        }`}
                                                        fill="none" 
                                                        stroke="currentColor" 
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-300/30 dark:bg-slate-700/30 rounded-full h-2">
                                                <div
                                                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Expandable Compliance Details */}
                                        {expandedPolicyId === policy.id && (
                                            <div className="mt-4 p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                                {isLoadingCompliance ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <Spinner size="md" />
                                                        <span className="ml-3 text-slate-600 dark:text-slate-400">Loading compliance data...</span>
                                                    </div>
                                                ) : complianceData ? (
                                                    <>
                                                        {/* Header with Tabs and Export */}
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setComplianceTab('acknowledged')}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                                        complianceTab === 'acknowledged'
                                                                            ? 'bg-green-600 text-white'
                                                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                                                    }`}
                                                                >
                                                                    ✅ Acknowledged ({complianceData.acknowledged.length})
                                                                </button>
                                                                <button
                                                                    onClick={() => setComplianceTab('pending')}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                                        complianceTab === 'pending'
                                                                            ? 'bg-amber-600 text-white'
                                                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                                                    }`}
                                                                >
                                                                    ⚠️ Pending ({complianceData.pending.length})
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    exportComplianceCSV(policy.title, complianceData, complianceTab);
                                                                }}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                Export CSV
                                                            </button>
                                                        </div>

                                                        {/* Search and Filters */}
                                                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                                                            <input
                                                                type="text"
                                                                placeholder="🔍 Search by name, email, or role..."
                                                                value={complianceSearch}
                                                                onChange={(e) => setComplianceSearch(e.target.value)}
                                                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                                                            />
                                                            {policy.target_audience.length > 1 && (
                                                                <select
                                                                    value={complianceFilter}
                                                                    onChange={(e) => setComplianceFilter(e.target.value as 'all' | 'staff' | 'student')}
                                                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                                                                >
                                                                    <option value="all">All</option>
                                                                    <option value="staff">Staff Only</option>
                                                                    <option value="student">Students Only</option>
                                                                </select>
                                                            )}
                                                        </div>

                                                        {/* Data Table */}
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-slate-200/50 dark:bg-slate-700/50">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Name</th>
                                                                        <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Type</th>
                                                                        <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Role/Class</th>
                                                                        {complianceTab === 'acknowledged' && (
                                                                            <>
                                                                                <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Date</th>
                                                                                <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Signature</th>
                                                                            </>
                                                                        )}
                                                                        {complianceTab === 'pending' && (
                                                                            <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">Email</th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                                    {getFilteredComplianceData().length === 0 ? (
                                                                        <tr>
                                                                            <td colSpan={complianceTab === 'acknowledged' ? 5 : 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                                                                No {complianceTab} users found
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        getFilteredComplianceData().map((user, idx) => (
                                                                            <tr key={`${user.type}-${user.id}-${idx}`} className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30">
                                                                                <td className="px-4 py-3 text-slate-900 dark:text-white">{user.name}</td>
                                                                                <td className="px-4 py-3">
                                                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                                                        user.type === 'staff' 
                                                                                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                                                            : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                                                    }`}>
                                                                                        {user.type}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                                                    {user.role || user.class_name || '-'}
                                                                                </td>
                                                                                {complianceTab === 'acknowledged' && (
                                                                                    <>
                                                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                                                            {user.acknowledged_at ? new Date(user.acknowledged_at).toLocaleDateString() : '-'}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                                                            {user.full_name_entered || '-'}
                                                                                        </td>
                                                                                    </>
                                                                                )}
                                                                                {complianceTab === 'pending' && (
                                                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                                                        {user.email || '-'}
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        ))
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                                        Failed to load compliance data
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
