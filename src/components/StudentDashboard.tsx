
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
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
  ExclamationCircleIcon,
  PencilIcon
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

      // TODO: Fetch actual attendance and assignments data when available
      const attendancePercentage = 85; // Placeholder
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

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome, {studentProfile.full_name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {studentProfile.class_name} {studentProfile.arm_name && `- ${studentProfile.arm_name}`}
          </p>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Attendance</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.attendancePercentage}%
              </p>
            </div>
            <ChartBarIcon className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        {/* Pending Assignments */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending Tasks</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.pendingAssignments}
              </p>
            </div>
            <ClipboardListIcon className="h-10 w-10 text-orange-500" />
          </div>
        </div>

        {/* Reward Points */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Reward Points</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.rewardPoints}
              </p>
            </div>
            <StarIcon className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        {/* Strikes */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active Strikes</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.totalStrikes}
              </p>
            </div>
            <ShieldIcon className="h-10 w-10 text-red-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigate(VIEWS.STUDENT_PROFILE_EDIT)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <PencilIcon className="h-8 w-8 text-blue-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Edit Profile</span>
          </button>
          <button
            onClick={() => onNavigate(VIEWS.ABSENCE_REQUESTS)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <CalendarIcon className="h-8 w-8 text-green-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Request Absence</span>
          </button>
          <button
            onClick={() => onNavigate(VIEWS.MY_SUBJECTS)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <BookOpenIcon className="h-8 w-8 text-purple-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">My Subjects</span>
          </button>
          <button
            onClick={() => onNavigate(VIEWS.STUDENT_STRIKES)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ShieldIcon className="h-8 w-8 text-red-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Strikes</span>
          </button>
          <button
            onClick={() => onNavigate(VIEWS.TIMETABLE)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ClockIcon className="h-8 w-8 text-indigo-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Timetable</span>
          </button>
        </div>
      </div>

      {/* Recent Absence Requests */}
      {recentAbsenceRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent Absence Requests</h2>
            <button
              onClick={() => onNavigate(VIEWS.ABSENCE_REQUESTS)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentAbsenceRequests.slice(0, 3).map((request) => (
              <div 
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {request.reason.substring(0, 60)}{request.reason.length > 60 ? '...' : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getAbsenceStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Strikes */}
      {strikes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Active Strikes</h2>
            <button
              onClick={() => onNavigate(VIEWS.STUDENT_STRIKES)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All & Appeal
            </button>
          </div>
          <div className="space-y-3">
            {strikes.slice(0, 3).map((strike) => (
              <div 
                key={strike.id}
                className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(strike.severity)}`}>
                      {strike.severity}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(strike.issued_date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {strike.reason}
                  </p>
                  {strike.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {strike.notes.substring(0, 80)}{strike.notes.length > 80 ? '...' : ''}
                    </p>
                  )}
                </div>
                {strike.appeal && strike.appeal.length > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                    Appeal {strike.appeal[0].status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
