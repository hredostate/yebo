import { useState } from 'react';
import { supa } from '../../../offline/client';
import type { ComplianceDashboardData, CompletionStats, UserComplianceData } from '../../../types/manuals';

/**
 * Hook for fetching compliance statistics
 */
export function useComplianceStats(schoolId: number) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch overall compliance dashboard data
   */
  const fetchDashboardData = async (): Promise<ComplianceDashboardData | null> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all assignments for the school
      const { data: assignments, error: assignmentsError } = await supa
        .from('manual_assignments')
        .select(`
          *,
          manual:manual_id(id, title),
          user:user_id(id, name, role)
        `)
        .eq('school_id', schoolId);

      if (assignmentsError) throw assignmentsError;

      // Fetch all manuals
      const { data: manuals, error: manualsError } = await supa
        .from('manuals')
        .select('id, title')
        .eq('school_id', schoolId)
        .eq('status', 'published');

      if (manualsError) throw manualsError;

      // Calculate overall stats
      const totalAssignments = assignments?.length || 0;
      const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
      const overdueAssignments = assignments?.filter(a => {
        if (a.status === 'completed') return false;
        if (!a.due_date) return false;
        return new Date(a.due_date) < new Date();
      }).length || 0;

      const overallCompletionRate = totalAssignments > 0
        ? (completedAssignments / totalAssignments) * 100
        : 0;

      // Calculate stats by manual
      const byManual: CompletionStats[] = (manuals || []).map(manual => {
        const manualAssignments = assignments?.filter(a => a.manual_id === manual.id) || [];
        const completed = manualAssignments.filter(a => a.status === 'completed').length;
        const inProgress = manualAssignments.filter(a => a.status === 'in_progress').length;
        const pending = manualAssignments.filter(a => a.status === 'pending').length;
        const overdue = manualAssignments.filter(a => {
          if (a.status === 'completed') return false;
          if (!a.due_date) return false;
          return new Date(a.due_date) < new Date();
        }).length;

        const totalAssigned = manualAssignments.length;
        const completionRate = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0;

        // Calculate average time to complete
        const completedWithTime = manualAssignments.filter(a =>
          a.status === 'completed' && a.assigned_at && a.completed_at
        );
        const avgTime = completedWithTime.length > 0
          ? completedWithTime.reduce((sum, a) => {
              const start = new Date(a.assigned_at).getTime();
              const end = new Date(a.completed_at!).getTime();
              return sum + (end - start);
            }, 0) / completedWithTime.length
          : 0;

        return {
          manual_id: manual.id,
          manual_title: manual.title,
          total_assigned: totalAssigned,
          completed,
          in_progress: inProgress,
          pending,
          overdue,
          completion_rate: completionRate,
          average_time_to_complete: avgTime,
        };
      });

      // Get overdue users
      const overdueUsers = (assignments || [])
        .filter(a => {
          if (a.status === 'completed') return false;
          if (!a.due_date) return false;
          return new Date(a.due_date) < new Date();
        })
        .map(a => {
          const dueDate = new Date(a.due_date!);
          const now = new Date();
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            user_id: a.user_id,
            user_name: (a.user as any)?.name || 'Unknown',
            user_role: (a.user as any)?.role || 'Unknown',
            manual_id: a.manual_id,
            manual_title: (a.manual as any)?.title || 'Unknown',
            due_date: a.due_date!,
            days_overdue: daysOverdue,
          };
        })
        .sort((a, b) => b.days_overdue - a.days_overdue);

      // Get recent completions
      const recentCompletions = (assignments || [])
        .filter(a => a.status === 'completed' && a.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
        .slice(0, 10)
        .map(a => ({
          user_id: a.user_id,
          user_name: (a.user as any)?.name || 'Unknown',
          manual_id: a.manual_id,
          manual_title: (a.manual as any)?.title || 'Unknown',
          completed_at: a.completed_at!,
        }));

      return {
        overall_stats: {
          total_manuals: manuals?.length || 0,
          total_assignments: totalAssignments,
          total_completed: completedAssignments,
          total_overdue: overdueAssignments,
          overall_completion_rate: overallCompletionRate,
        },
        by_manual: byManual,
        overdue_users: overdueUsers,
        recent_completions: recentCompletions,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch compliance data for a specific user
   */
  const fetchUserCompliance = async (userId: string): Promise<UserComplianceData | null> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user info
      const { data: user, error: userError } = await supa
        .from('user_profiles')
        .select('id, name, role')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Fetch user's assignments
      const { data: assignments, error: assignmentsError } = await supa
        .from('manual_assignments')
        .select(`
          *,
          manual:manual_id(id, title, category)
        `)
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (assignmentsError) throw assignmentsError;

      // Calculate stats
      const totalAssignments = assignments?.length || 0;
      const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
      const completionRate = totalAssignments > 0
        ? (completedAssignments / totalAssignments) * 100
        : 0;

      const totalTimeSpent = assignments?.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0) || 0;

      const overdueCount = assignments?.filter(a => {
        if (a.status === 'completed') return false;
        if (!a.due_date) return false;
        return new Date(a.due_date) < new Date();
      }).length || 0;

      return {
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        assignments: assignments || [],
        completion_rate: completionRate,
        total_time_spent: totalTimeSpent,
        overdue_count: overdueCount,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user compliance data');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get completion stats for a specific manual
   */
  const fetchManualStats = async (manualId: number): Promise<CompletionStats | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: manual, error: manualError } = await supa
        .from('manuals')
        .select('id, title')
        .eq('id', manualId)
        .single();

      if (manualError) throw manualError;

      const { data: assignments, error: assignmentsError } = await supa
        .from('manual_assignments')
        .select('*')
        .eq('manual_id', manualId);

      if (assignmentsError) throw assignmentsError;

      const totalAssigned = assignments?.length || 0;
      const completed = assignments?.filter(a => a.status === 'completed').length || 0;
      const inProgress = assignments?.filter(a => a.status === 'in_progress').length || 0;
      const pending = assignments?.filter(a => a.status === 'pending').length || 0;
      const overdue = assignments?.filter(a => {
        if (a.status === 'completed') return false;
        if (!a.due_date) return false;
        return new Date(a.due_date) < new Date();
      }).length || 0;

      const completionRate = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0;

      // Calculate average time to complete
      const completedWithTime = assignments?.filter(a =>
        a.status === 'completed' && a.assigned_at && a.completed_at
      ) || [];
      const avgTime = completedWithTime.length > 0
        ? completedWithTime.reduce((sum, a) => {
            const start = new Date(a.assigned_at).getTime();
            const end = new Date(a.completed_at!).getTime();
            return sum + (end - start);
          }, 0) / completedWithTime.length
        : 0;

      return {
        manual_id: manual.id,
        manual_title: manual.title,
        total_assigned: totalAssigned,
        completed,
        in_progress: inProgress,
        pending,
        overdue,
        completion_rate: completionRate,
        average_time_to_complete: avgTime,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manual stats');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchDashboardData,
    fetchUserCompliance,
    fetchManualStats,
  };
}
