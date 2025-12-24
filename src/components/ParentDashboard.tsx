
import React, { useState, useEffect } from 'react';
import type { ParentProfile, LinkedChild, StudentTermReport, AttendanceRecord } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import ChildSwitcher from './parent/ChildSwitcher';
import Spinner from './common/Spinner';
import { 
    HomeIcon, 
    DocumentIcon, 
    CalendarIcon, 
    CurrencyIcon, 
    ChatIcon,
    UserCircleIcon 
} from './common/icons';

interface ParentDashboardProps {
    parentProfile: ParentProfile;
    linkedChildren: LinkedChild[];
    selectedChild: LinkedChild | null;
    onSelectChild: (child: LinkedChild) => void;
    onLogout: () => void;
}

type DashboardTab = 'overview' | 'reports' | 'attendance' | 'fees' | 'profile';

const ParentDashboard: React.FC<ParentDashboardProps> = ({
    parentProfile,
    linkedChildren,
    selectedChild,
    onSelectChild,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState<StudentTermReport[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

    useEffect(() => {
        if (selectedChild) {
            loadChildData();
        }
    }, [selectedChild, activeTab]);

    const loadChildData = async () => {
        if (!selectedChild) return;
        
        setLoading(true);
        const supabase = requireSupabaseClient();

        try {
            if (activeTab === 'reports' && selectedChild.permissions.canViewReports) {
                const { data } = await supabase
                    .from('student_term_reports')
                    .select('*')
                    .eq('student_id', selectedChild.id)
                    .order('created_at', { ascending: false });
                
                if (data) setReports(data);
            }

            if (activeTab === 'attendance' && selectedChild.permissions.canViewAttendance) {
                const { data } = await supabase
                    .from('attendance_records')
                    .select('*')
                    .eq('student_id', selectedChild.id)
                    .order('date', { ascending: false })
                    .limit(30);
                
                if (data) setAttendance(data);
            }
        } catch (error) {
            console.error('Error loading child data:', error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview' as DashboardTab, label: 'Overview', icon: HomeIcon },
        { id: 'reports' as DashboardTab, label: 'Report Cards', icon: DocumentIcon },
        { id: 'attendance' as DashboardTab, label: 'Attendance', icon: CalendarIcon },
        { id: 'fees' as DashboardTab, label: 'Fees', icon: CurrencyIcon },
        { id: 'profile' as DashboardTab, label: 'Profile', icon: UserCircleIcon },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Portal</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Welcome, {parentProfile.name}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Child Switcher */}
                <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                    <ChildSwitcher
                        children={linkedChildren}
                        selectedChild={selectedChild}
                        onSelectChild={onSelectChild}
                    />
                </div>

                {selectedChild ? (
                    <>
                        {/* Navigation Tabs */}
                        <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                            <nav className="flex gap-2" role="tablist">
                                {tabs.map(tab => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                            role="tab"
                                            aria-selected={isActive}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Content Area */}
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                            {loading ? (
                                <div className="flex justify-center items-center py-12">
                                    <Spinner />
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'overview' && (
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                                Overview for {selectedChild.name}
                                            </h2>
                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                                    <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Class</div>
                                                    <div className="mt-1 text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                                                        {selectedChild.class?.name} {selectedChild.arm?.name}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                    <div className="text-sm font-medium text-green-700 dark:text-green-300">Status</div>
                                                    <div className="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">
                                                        {selectedChild.status || 'Active'}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Admission No.</div>
                                                    <div className="mt-1 text-2xl font-bold text-purple-900 dark:text-purple-100">
                                                        {selectedChild.admission_number || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-6">
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Recent Activity</h3>
                                                <p className="text-slate-600 dark:text-slate-400">
                                                    No recent activity to display
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'reports' && (
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                                Report Cards
                                            </h2>
                                            {selectedChild.permissions.canViewReports ? (
                                                reports.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {reports.map(report => (
                                                            <div
                                                                key={report.id}
                                                                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                                            >
                                                                <div className="font-medium text-slate-900 dark:text-white">
                                                                    Term Report - {new Date(report.created_at).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                                    Click to view details
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-600 dark:text-slate-400">
                                                        No report cards available yet
                                                    </p>
                                                )
                                            ) : (
                                                <p className="text-amber-600 dark:text-amber-400">
                                                    You don't have permission to view reports for this child
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'attendance' && (
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                                Attendance Records
                                            </h2>
                                            {selectedChild.permissions.canViewAttendance ? (
                                                attendance.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {attendance.map((record, idx) => (
                                                            <div
                                                                key={record.id || idx}
                                                                className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                                                            >
                                                                <span className="text-slate-900 dark:text-white">
                                                                    {new Date(record.date).toLocaleDateString()}
                                                                </span>
                                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                                    record.status === 'present' 
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                                }`}>
                                                                    {record.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-600 dark:text-slate-400">
                                                        No attendance records available
                                                    </p>
                                                )
                                            ) : (
                                                <p className="text-amber-600 dark:text-amber-400">
                                                    You don't have permission to view attendance for this child
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'fees' && (
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                                Fees & Payments
                                            </h2>
                                            {selectedChild.permissions.canViewFinances ? (
                                                <p className="text-slate-600 dark:text-slate-400">
                                                    Fee management coming soon
                                                </p>
                                            ) : (
                                                <p className="text-amber-600 dark:text-amber-400">
                                                    You don't have permission to view fees for this child
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'profile' && (
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                                Your Profile
                                            </h2>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                                                    <div className="mt-1 text-slate-900 dark:text-white">{parentProfile.name}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
                                                    <div className="mt-1 text-slate-900 dark:text-white">{parentProfile.phone_number}</div>
                                                </div>
                                                {parentProfile.email && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                                        <div className="mt-1 text-slate-900 dark:text-white">{parentProfile.email}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                        <p className="text-slate-600 dark:text-slate-400">
                            No children linked to your account. Please contact school administration.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ParentDashboard;
