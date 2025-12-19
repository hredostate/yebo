import { useState } from 'react';
import { supa } from '../../../offline/client';
import type { ManualAssignment, AssignmentStatus } from '../../../types/manuals';

/**
 * Hook for managing manual assignments
 */
export function useManualAssignments() {
  const [assignments, setAssignments] = useState<ManualAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch assignments for a specific user
   */
  const fetchUserAssignments = async (userId: string, filters?: {
    status?: AssignmentStatus;
    includeCompleted?: boolean;
  }) => {
    try {
      setLoading(true);
      setError(null);

      let query = supa
        .from('manual_assignments')
        .select(`
          *,
          manual:manual_id(
            id,
            title,
            description,
            category,
            file_url,
            requires_acknowledgment,
            acknowledgment_text
          ),
          assigner:assigned_by(id, name)
        `)
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      } else if (!filters?.includeCompleted) {
        query = query.neq('status', 'completed');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setAssignments(data || []);
      return data || [];
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assignments');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch assignments for a specific manual
   */
  const fetchManualAssignments = async (manualId: number) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supa
        .from('manual_assignments')
        .select(`
          *,
          user:user_id(id, name, role, email)
        `)
        .eq('manual_id', manualId)
        .order('assigned_at', { ascending: false });

      if (fetchError) throw fetchError;

      return data || [];
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manual assignments');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Assign a manual to users
   */
  const assignManual = async (
    manualId: number,
    userIds: string[],
    schoolId: number,
    assignedBy: string,
    daysToComplete: number,
    reason?: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysToComplete);

      const assignments = userIds.map(userId => ({
        manual_id: manualId,
        user_id: userId,
        school_id: schoolId,
        assigned_by: assignedBy,
        due_date: dueDate.toISOString(),
        reason: reason || 'Manual assignment',
        status: 'pending' as AssignmentStatus,
      }));

      const { error: insertError } = await supa
        .from('manual_assignments')
        .insert(assignments);

      if (insertError) throw insertError;

      // Log compliance actions
      const complianceLogs = userIds.map(userId => ({
        manual_id: manualId,
        user_id: userId,
        action: 'assigned' as const,
        details: {
          assigned_by: assignedBy,
          due_date: dueDate.toISOString(),
          reason: reason || 'Manual assignment',
        },
        performed_by: assignedBy,
      }));

      await supa.from('manual_compliance_log').insert(complianceLogs);

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to assign manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start reading a manual (mark as in_progress)
   */
  const startReading = async (
    assignmentId: number,
    userId: string,
    manualId: number
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Update assignment status
      const { error: updateError } = await supa
        .from('manual_assignments')
        .update({
          status: 'in_progress',
          started_at: now,
        })
        .eq('id', assignmentId)
        .eq('started_at', null); // Only update if not already started

      if (updateError) throw updateError;

      // Log compliance action
      await supa.from('manual_compliance_log').insert({
        manual_id: manualId,
        user_id: userId,
        action: 'started',
        details: { started_at: now },
        performed_by: userId,
      });

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to start reading';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a reading session
   */
  const createReadSession = async (
    assignmentId: number,
    userId: string,
    manualId: number
  ): Promise<{ sessionId: number | null; error: string | null }> => {
    try {
      const { data, error: insertError } = await supa
        .from('manual_read_sessions')
        .insert({
          assignment_id: assignmentId,
          user_id: userId,
          manual_id: manualId,
          session_start: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return { sessionId: data.id, error: null };
    } catch (err: any) {
      return { sessionId: null, error: err.message };
    }
  };

  /**
   * Update reading session
   */
  const updateReadSession = async (
    sessionId: number,
    pagesViewed: number[],
    lastPage: number,
    totalPages: number
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      const { error: updateError } = await supa
        .from('manual_read_sessions')
        .update({
          session_end: new Date().toISOString(),
          pages_viewed: pagesViewed,
          last_page_viewed: lastPage,
          total_pages: totalPages,
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  /**
   * Complete a manual and acknowledge
   */
  const completeAndAcknowledge = async (
    assignmentId: number,
    userId: string,
    manualId: number,
    signature: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Update assignment
      const { error: updateError } = await supa
        .from('manual_assignments')
        .update({
          status: 'completed',
          completed_at: now,
          acknowledged: true,
          acknowledged_at: now,
          acknowledgment_signature: signature,
          ip_address: ipAddress || null,
        })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      // Log compliance actions
      await supa.from('manual_compliance_log').insert([
        {
          manual_id: manualId,
          user_id: userId,
          action: 'completed',
          details: { completed_at: now },
          performed_by: userId,
        },
        {
          manual_id: manualId,
          user_id: userId,
          action: 'acknowledged',
          details: {
            acknowledged_at: now,
            signature: signature,
            ip_address: ipAddress,
          },
          performed_by: userId,
        },
      ]);

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to complete manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get user's IP address
   */
  const getUserIP = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || null;
    } catch {
      return null;
    }
  };

  return {
    assignments,
    loading,
    error,
    fetchUserAssignments,
    fetchManualAssignments,
    assignManual,
    startReading,
    createReadSession,
    updateReadSession,
    completeAndAcknowledge,
    getUserIP,
  };
}
