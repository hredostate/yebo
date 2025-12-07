import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import type { LeaveRequest } from '../../types';

export const useLeaveRequests = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: ['leaveRequests', userId],
    queryFn: async (): Promise<LeaveRequest[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, leave_type:leave_types!leave_type_id(*)')
        .eq('requester_id', userId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!userId && userId.trim() !== '',
  });
};

export const useCreateLeaveRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (requestData: Partial<LeaveRequest>) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert(requestData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate the specific user's leave requests
      if (data?.requester_id) {
        queryClient.invalidateQueries({ queryKey: ['leaveRequests', data.requester_id] });
      }
    },
  });
};
