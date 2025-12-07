import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import type { PayrollAdjustment } from '../../types';

export const usePayrollAdjustments = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: ['payrollAdjustments', userId],
    queryFn: async (): Promise<PayrollAdjustment[]> => {
      const { data, error } = await supabase
        .from('payroll_adjustments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!userId && userId.trim() !== '',
  });
};
