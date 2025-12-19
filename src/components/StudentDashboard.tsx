
import React, { useState, useEffect, useCallback } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, StudentDashboardStats, AbsenceRequest, StudentStrike } from '../types';
import Spinner from './common/Spinner';
import {
  UserCircleIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardListIcon,
  ShieldIcon,
  ChartBarIcon,
  StarIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilIcon,
  GiftIcon,
  BanknotesIcon
} from './common/icons';
import { VIEWS } from '../constants';

interface StudentDashboardProps {
  studentProfile: StudentProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  isDarkMode?: boolean;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ 
  studentProfile, 
  addToast, 
  onNavigate,
  isDarkMode 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<StudentDashboardStats>({
    attendancePercentage: 0,
    pendingAssignments: 0,
    totalStrikes: 0,
    rewardPoints: 0,
    pendingAbsenceRequests: 0
  });
  const [recentAbsenceRequests, setRecentAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [strikes, setStrikes] = useState<StudentStrike[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!studentProfile.student_record_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch student data to get reward points
      const { data: studentData } = await supabase
        .from('students')
        .select('reward_points')
        .eq('id', studentProfile.student_record_id)
        .single();

      // Fetch absence requests
      const { data: absenceData } = await supabase
        .from('absence_requests')
        .select('*')
        .eq('student_id', studentProfile.student_record_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch strikes (non-archived)
      const { data: strikesData } = await supabase
        .from('student_strikes')
        .select(`
          *,
          issuer:user_profiles!student_strikes_issued_by_fkey(name),
          appeal:strike_appeals(*)
        `)
        .eq('student_id', studentProfile.student_record_id)
        .eq('archived', false)
        .order('issued_date', { ascending: false });

      // Count pending absence requests
      const pendingRequests = absenceData?.filter(r => r.status === 'pending').length || 0;

      // Fetch real attendance data
      let attendancePercentage = 0;

      // Step 1: Fetch active term
      const { data: activeTerm } = await supabase
        .from('terms')
        .select('id, start_date, end_date')
        .eq('school_id', studentProfile.school_id)
        .eq('is_active', true)
        .maybeSingle();

      if (activeTerm) {
        // Step 2: Get student's class group membership
        const { data: membership } = await supabase
          .from('class_group_members')
          .select('id, group_id')
          .eq('student_id', studentProfile.student_record_id)
          .maybeSingle();

        if (membership) {
          // Step 3: Check for attendance override
          const { data: override } = await supabase
            .from('attendance_overrides')
            .select('days_present, total_days')
            .eq('student_id', studentProfile.student_record_id)
            .eq('term_id', activeTerm.id)
            .eq('class_group_id', membership.group_id)
            .maybeSingle();

          if (override) {
            // Use override values
            const total = override.total_days || 0;
            attendancePercentage = total > 0 ? Math.round((override.days_present / total) * 100) : 0;
          } else {
            // Step 4: Compute from attendance records
            const { data: records } = await supabase
              .from('attendance_records')
              .select('status, session_date')
              .eq('member_id', membership.id)
              .gte('session_date', activeTerm.start_date)
              .lte('session_date', activeTerm.end_date);

            const presentCount = records?.filter(r => 
              r.status && ['present', 'p'].includes(r.status.toLowerCase())
            ).length || 0;
            const totalRecords = records?.length || 0;

            // Step 5: Calculate attendance percentage
            if (totalRecords > 0) {
              attendancePercentage = Math.round((presentCount / totalRecords) * 100);
            }
          }
        }
      }

      // TODO: Fetch actual assignments data when available
      const pendingAssignments = 3; // Placeholder

      setStats({
        attendancePercentage,
        pendingAssignments,
        totalStrikes: strikesData?.length || 0,
        rewardPoints: studentData?.reward_points || 0,
        pendingAbsenceRequests: pendingRequests
      });

      setRecentAbsenceRequests(absenceData || []);
      setStrikes(strikesData || []);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      addToast(`Error loading dashboard: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [studentProfile, addToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const getAbsenceStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'denied': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Severe': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'Major': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
    }
  };

  const statCards = [
    { label: 'Attendance', value: `${stats.attendancePercentage}%`, icon: <ChartBarIcon className="w-6 h-6 text-blue-500" /> },
    { label: 'Pending Tasks', value: stats.pendingAssignments, icon: <ClipboardListIcon className="w-6 h-6 text-orange-500" /> },
    { label: 'Reward Points', value: stats.rewardPoints, icon: <StarIcon className="w-6 h-6 text-yellow-500" /> },
    { label: 'Active Strikes', value: stats.totalStrikes, icon: <ShieldIcon className="w-6 h-6 text-red-500" /> }
  ];

  const primaryActions = [
    { label: 'My Subjects', view: VIEWS.MY_SUBJECTS, icon: <BookOpenIcon className="w-5 h-5 text-purple-500" /> },
    { label: 'Lesson Plans', view: VIEWS.STUDENT_LESSON_PORTAL, icon: <BookOpenIcon className="w-5 h-5 text-blue-500" /> },
    { label: 'Homework', view: VIEWS.STUDENT_HOMEWORK, icon: <PencilIcon className="w-5 h-5 text-orange-500" /> },
    { label: 'Timetable', view: VIEWS.TIMETABLE, icon: <ClockIcon className="w-5 h-5 text-indigo-500" /> },
    { label: 'Report Cards', view: VIEWS.STUDENT_REPORTS, icon: <ChartBarIcon className="w-5 h-5 text-green-500" /> },
    { label: 'Wallet & Fees', view: VIEWS.STUDENT_FINANCES, icon: <BanknotesIcon className="w-5 h-5 text-emerald-600" /> }
  ];

  const engagementActions = [
    { label: 'Rate Teachers', view: VIEWS.RATE_MY_TEACHER, icon: <StarIcon className="w-5 h-5 text-yellow-500" /> },
    { label: 'Surveys & Quizzes', view: VIEWS.STUDENT_SURVEYS, icon: <ClipboardListIcon className="w-5 h-5 text-blue-500" /> },
    { label: 'Reward Store', view: VIEWS.STOREFRONT, icon: <GiftIcon className="w-5 h-5 text-purple-500" /> }
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-500">Student Dashboard</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome, {studentProfile.full_name}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            {studentProfile.class_name} {studentProfile.arm_name && `• ${studentProfile.arm_name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate(VIEWS.STUDENT_FINANCES)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold shadow-sm"
          >
            View wallet
          </button>
          <button
            onClick={() => onNavigate(VIEWS.ABSENCE_REQUESTS)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Request absence
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700">{card.icon}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Today&apos;s focus</h2>
              <span className="text-xs font-semibold text-indigo-500">Quick actions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {primaryActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.view)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-left hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-white dark:bg-slate-900">{action.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{action.label}</p>
                      <p className="text-xs text-slate-500">Open</p>
                    </div>
                  </div>
                  <CheckCircleIcon className="w-5 h-5 text-indigo-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Engagement</h3>
                <span className="text-xs text-slate-500">Stay involved</span>
              </div>
              <div className="space-y-2">
                {engagementActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => onNavigate(action.view)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
                  >
                    <span className="p-2 rounded-lg bg-white dark:bg-slate-900">{action.icon}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Personal & admin</h3>
                <span className="text-xs text-slate-500">Profile & requests</span>
              </div>
              <div className="space-y-2">
                <button onClick={() => onNavigate(VIEWS.STUDENT_PROFILE_EDIT)} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                  <span className="p-2 rounded-lg bg-white dark:bg-slate-900"><UserCircleIcon className="w-5 h-5 text-blue-500" /></span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Edit profile</span>
                </button>
                <button onClick={() => onNavigate(VIEWS.ABSENCE_REQUESTS)} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                  <span className="p-2 rounded-lg bg-white dark:bg-slate-900"><CalendarIcon className="w-5 h-5 text-green-500" /></span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Absence requests</span>
                </button>
                <button onClick={() => onNavigate(VIEWS.STUDENT_STRIKES)} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                  <span className="p-2 rounded-lg bg-white dark:bg-slate-900"><ShieldIcon className="w-5 h-5 text-red-500" /></span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Strikes & appeals</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {recentAbsenceRequests.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent requests</h3>
                <button onClick={() => onNavigate(VIEWS.ABSENCE_REQUESTS)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">See all</button>
              </div>
              <div className="space-y-3">
                {recentAbsenceRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getAbsenceStatusColor(request.status)}`}>{request.status}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{request.reason.substring(0, 60)}{request.reason.length > 60 ? '...' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {strikes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Conduct alerts</h3>
                <button onClick={() => onNavigate(VIEWS.STUDENT_STRIKES)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Appeal</button>
              </div>
              <div className="space-y-3">
                {strikes.slice(0, 3).map((strike) => (
                  <div key={strike.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(strike.severity)}`}>{strike.severity}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(strike.issued_date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{strike.reason}</p>
                    {strike.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{strike.notes.substring(0, 80)}{strike.notes.length > 80 ? '...' : ''}</p>
                    )}
                    {strike.appeal && strike.appeal.length > 0 && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1">Appeal {strike.appeal[0].status}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default StudentDashboard;
